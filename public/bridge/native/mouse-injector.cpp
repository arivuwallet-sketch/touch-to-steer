#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <iostream>
#include <sstream>
#include <string>
#include <cctype>

static void moveMouse(LONG dx, LONG dy) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
    SendInput(1, &input, sizeof(INPUT));
}

static void buttonMouse(const std::string& name, bool down) {
    DWORD flag = 0;
    if (name == "left") flag = down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    else if (name == "right") flag = down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    else if (name == "middle") flag = down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    else if (name == "back") flag = down ? MOUSEEVENTF_XDOWN : MOUSEEVENTF_XUP;
    else if (name == "forward") flag = down ? MOUSEEVENTF_XDOWN : MOUSEEVENTF_XUP;
    else return;

    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = flag;
    if (name == "back") input.mi.mouseData = XBUTTON1;
    if (name == "forward") input.mi.mouseData = XBUTTON2;
    SendInput(1, &input, sizeof(INPUT));
}

static void wheelMouse(LONG delta) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_WHEEL;
    input.mi.mouseData = static_cast<DWORD>(delta);
    SendInput(1, &input, sizeof(INPUT));
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
            LONG dx = 0, dy = 0;
            in >> dx >> dy;
            moveMouse(dx, dy);
            continue;
        }

        if (command == "BUTTON") {
            std::string name, state;
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
        }
    }

    return 0;
}
