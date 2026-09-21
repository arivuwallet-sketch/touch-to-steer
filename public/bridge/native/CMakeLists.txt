cmake_minimum_required(VERSION 3.20)
project(TouchToSteerMouseInjector LANGUAGES CXX)

add_executable(mouse-injector WIN32 mouse-injector.cpp)
target_compile_features(mouse-injector PRIVATE cxx_std_17)
target_compile_definitions(mouse-injector PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN)
set_target_properties(mouse-injector PROPERTIES
  WIN32_EXECUTABLE TRUE
  OUTPUT_NAME "mouse-injector"
)
