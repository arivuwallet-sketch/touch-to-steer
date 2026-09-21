cmake_minimum_required(VERSION 3.20)
project(TouchToSteerMouseInjector LANGUAGES CXX)

add_executable(mouse-injector mouse-injector.cpp)
target_compile_features(mouse-injector PRIVATE cxx_std_17)
target_compile_definitions(mouse-injector PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN)
set_target_properties(mouse-injector PROPERTIES
  OUTPUT_NAME "mouse-injector"
)

if(MSVC)
  # Keep the small native mouse helper independent of a separately installed
  # Visual C++ redistributable on the end-user PC.
  set_property(TARGET mouse-injector PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
endif()
