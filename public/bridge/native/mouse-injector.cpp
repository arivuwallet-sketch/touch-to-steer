#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <iostream>
#include <sstream>
#include <string>

static bool inject(INPUT& input) {
    const UINT sent = SendInput(1, &input, sizeof(INPUT));
    if (sent == 1) return true;

    // Legacy fallback for Windows configurations that reject SendInput.
    SetLastError(ERROR_SUCCESS);
    if (input.type == INPUT_MOUSE) {
        mouse_event(input.mi.dwFlags, input.mi.mouseData, 0, static_cast<DWORD>(input.mi.dy), 0);
        return GetLastError() == ERROR_SUCCESS;
    }
    return false;
}

static void moveMouse(LONG dx, LONG dy) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
    inject(input);
}

static void buttonMouse(const std::string& name, bool down) {
    DWORD flag = 0;
    if (name == "left") flag = down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    else if (name == "right") flag = down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    else if (name == "middle") flag = down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    else if (name == "back" || name == "forward") flag = down ? MOUSEEVENTF_XDOWN : MOUSEEVENTF_XUP;
    else return;

    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = flag;
    if (name == "back") input.mi.mouseData = XBUTTON1;
    if (name == "forward") input.mi.mouseData = XBUTTON2;
    inject(input);
}

static void wheelMouse(LONG delta) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_WHEEL;
    input.mi.mouseData = static_cast<DWORD>(delta);
    inject(input);
}

static void centerMouse() {
    // Synchronize the PC cursor with the logical origin represented by the
    // phone's centered air-mouse surface.
    const int width = GetSystemMetrics(SM_CXSCREEN);
    const int height = GetSystemMetrics(SM_CYSCREEN);
    if (width > 0 && height > 0) {
        SetCursorPos(width / 2, height / 2);
    }
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cout << "READY\n" << std::flush;
    std::string line;

    while (std::getline(std::cin, line)) {
        std::istringstream in(line);
        std::string command;
        in >> command;

        if (command == "MOVE") {
            LONG dx = 0;
            LONG dy = 0;
            in >> dx >> dy;
            moveMouse(dx, dy);
            continue;
        }

        if (command == "BUTTON") {
            std::string name;
            std::string state;
            in >> name >> state;
            buttonMouse(name, state == "DOWN");
            continue;
        }

        if (command == "WHEEL") {
            LONG delta = 0;
            in >> delta;
            wheelMouse(delta);
            continue;
        }

        if (command == "RESET") {
            const char* buttons[] = {"left", "right", "middle", "back", "forward"};
            for (const char* button : buttons) buttonMouse(button, false);
            continue;
        }

        if (command == "CENTER") {
            centerMouse();
            continue;
        }
    }

    return 0;
}
