#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>
#include <mmreg.h>
#include <ksmedia.h>
#include <avrt.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <thread>
#include <vector>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "avrt.lib")

namespace {
constexpr double kSamplePeriodSeconds = 0.020; // ~20 ms analysis blocks
constexpr double kCooldownSeconds = 0.045;

struct AnalyzerState {
    double low = 0.0;
    double noise = 0.008;
    double previousEnergy = 0.0;
    double cooldown = 0.0;
    bool engineActive = false;
};

float readSample(const BYTE* p, WORD bitsPerSample, bool isFloat) {
    if (isFloat && bitsPerSample == 32) {
        float v = 0.0f;
        std::memcpy(&v, p, sizeof(float));
        return std::clamp(std::isfinite(v) ? v : 0.0f, -1.0f, 1.0f);
    }

    if (bitsPerSample == 16) {
        int16_t v = 0;
        std::memcpy(&v, p, sizeof(int16_t));
        return static_cast<float>(v) / 32768.0f;
    }

    if (bitsPerSample == 24) {
        int32_t v = (static_cast<int32_t>(p[0]) |
                     (static_cast<int32_t>(p[1]) << 8) |
                     (static_cast<int32_t>(p[2]) << 16));
        if (v & 0x00800000) v |= 0xFF000000;
        return static_cast<float>(v) / 8388608.0f;
    }

    if (bitsPerSample == 32) {
        int32_t v = 0;
        std::memcpy(&v, p, sizeof(int32_t));
        return static_cast<float>(v) / 2147483648.0f;
    }

    return 0.0f;
}

bool isFloatFormat(const WAVEFORMATEX* format) {
    if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) return true;
    if (format->wFormatTag == WAVE_FORMAT_EXTENSIBLE) {
        const auto* ext = reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
        return IsEqualGUID(ext->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);
    }
    return false;
}

void emit(const char* kind, double strong, double weak, int duration) {
    std::printf("HAPTIC %s %.3f %.3f %d\n", kind, strong, weak, duration);
    std::fflush(stdout);
}

void analyzeBlock(
    const float* samples,
    size_t frames,
    UINT channels,
    UINT bytesPerSample,
    bool isFloat,
    AnalyzerState& state
) {
    if (!frames || !channels) return;

    double fullSq = 0.0;
    double lowSq = 0.0;
    double highSq = 0.0;

    const double alpha = 0.075;
    for (size_t frame = 0; frame < frames; ++frame) {
        double mono = 0.0;
        for (UINT ch = 0; ch < channels; ++ch) {
            mono += samples[frame * channels + ch];
        }
        mono /= static_cast<double>(channels);

        state.low += alpha * (mono - state.low);
        const double high = mono - state.low;
        fullSq += mono * mono;
        lowSq += state.low * state.low;
        highSq += high * high;
    }

    const double inv = 1.0 / static_cast<double>(frames);
    const double energy = std::sqrt(std::max(0.0, fullSq * inv));
    const double low = std::sqrt(std::max(0.0, lowSq * inv));
    const double high = std::sqrt(std::max(0.0, highSq * inv));

    const double rise = energy - state.previousEnergy;
    state.previousEnergy = state.previousEnergy * 0.78 + energy * 0.22;
    state.noise = state.noise * 0.985 + std::min(energy, 0.08) * 0.015;
    state.cooldown = std::max(0.0, state.cooldown - kSamplePeriodSeconds);

    // Strong low-end transient + broadband energy: explosion / crash / collision.
    if (state.cooldown <= 0.0 &&
        energy > 0.20 &&
        low > 0.13 &&
        high > 0.055 &&
        rise > 0.045) {
        emit("heavy", 1.0, 0.8, 380);
        state.cooldown = kCooldownSeconds;
        state.engineActive = false;
        return;
    }

    // Fast high-frequency transient: automatic weapon / mechanical impact.
    if (state.cooldown <= 0.0 &&
        high > 0.090 &&
        rise > 0.035 &&
        energy < 0.30) {
        emit("gunfire", 0.0, 0.9, 55);
        state.cooldown = kCooldownSeconds;
        state.engineActive = false;
        return;
    }

    // Small isolated click/beep: menu/loading/selection feedback.
    if (state.cooldown <= 0.0 &&
        energy > 0.018 &&
        energy < 0.085 &&
        high > 0.018 &&
        rise > 0.012) {
        emit("ui", 0.0, 0.2, 40);
        state.cooldown = kCooldownSeconds;
        return;
    }

    // Sustained low-frequency bed: approximate engine/vehicle rumble.
    if (low > 0.035 && energy > std::max(0.018, state.noise * 1.9) && high < 0.085) {
        if (!state.engineActive) {
            emit("engine", 0.2, 0.1, 180);
            state.engineActive = true;
        } else if (state.cooldown <= 0.0) {
            emit("engine", 0.2, 0.1, 160);
            state.cooldown = 0.12;
        }
        return;
    }

    if (energy < std::max(0.015, state.noise * 1.45)) {
        state.engineActive = false;
    }
}

int runCapture() {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) return 2;

    IMMDeviceEnumerator* enumerator = nullptr;
    IMMDevice* device = nullptr;
    IAudioClient* audioClient = nullptr;
    IAudioCaptureClient* capture = nullptr;
    WAVEFORMATEX* format = nullptr;

    hr = CoCreateInstance(
        __uuidof(MMDeviceEnumerator),
        nullptr,
        CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator),
        reinterpret_cast<void**>(&enumerator)
    );
    if (FAILED(hr)) return 3;

    hr = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
    if (FAILED(hr)) return 4;

    hr = device->Activate(
        __uuidof(IAudioClient),
        CLSCTX_ALL,
        nullptr,
        reinterpret_cast<void**>(&audioClient)
    );
    if (FAILED(hr)) return 5;

    hr = audioClient->GetMixFormat(&format);
    if (FAILED(hr) || !format) return 6;

    // WASAPI loopback captures the Windows render mix without needing to
    // inject into or modify the game process.
    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        0,
        0,
        format,
        nullptr
    );
    if (FAILED(hr)) return 7;

    hr = audioClient->GetService(
        __uuidof(IAudioCaptureClient),
        reinterpret_cast<void**>(&capture)
    );
    if (FAILED(hr)) return 8;

    hr = audioClient->Start();
    if (FAILED(hr)) return 9;

    const UINT channels = format->nChannels;
    const UINT bytesPerFrame = format->nBlockAlign;
    const UINT bytesPerSample = format->wBitsPerSample / 8;
    const bool floatFormat = isFloatFormat(format);

    AnalyzerState state;

    while (true) {
        UINT32 packetFrames = 0;
        HRESULT sizeHr = capture->GetNextPacketSize(&packetFrames);
        if (FAILED(sizeHr)) break;

        if (packetFrames == 0) {
            Sleep(8);
            continue;
        }

        BYTE* data = nullptr;
        UINT32 frames = 0;
        DWORD flags = 0;
        hr = capture->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
        if (FAILED(hr)) break;

        if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT) && data && frames > 0) {
            // Convert supported PCM formats to float.
            std::vector<float> converted;
            converted.resize(static_cast<size_t>(frames) * channels);

            for (UINT32 frame = 0; frame < frames; ++frame) {
                for (UINT ch = 0; ch < channels; ++ch) {
                    const BYTE* samplePtr =
                        data + static_cast<size_t>(frame) * bytesPerFrame +
                        static_cast<size_t>(ch) * bytesPerSample;
                    converted[static_cast<size_t>(frame) * channels + ch] =
                        readSample(samplePtr, format->wBitsPerSample, floatFormat);
                }
            }

            analyzeBlock(converted.data(), frames, channels, bytesPerSample, floatFormat, state);
        } else {
            state.engineActive = false;
        }

        capture->ReleaseBuffer(frames);
    }

    audioClient->Stop();
    if (format) CoTaskMemFree(format);
    if (capture) capture->Release();
    if (audioClient) audioClient->Release();
    if (device) device->Release();
    if (enumerator) enumerator->Release();
    CoUninitialize();
    return 0;
}


int main() {
    return runCapture();
}
