cmake_minimum_required(VERSION 3.20)
project(TouchToSteerMouseInjector LANGUAGES CXX)

add_executable(mouse-injector mouse-injector.cpp)
target_compile_features(mouse-injector PRIVATE cxx_std_17)
target_compile_definitions(mouse-injector PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN)
set_target_properties(mouse-injector PROPERTIES
  OUTPUT_NAME "mouse-injector"
)

add_executable(game-audio-haptics game-audio-haptics.cpp)
target_compile_features(game-audio-haptics PRIVATE cxx_std_17)
target_compile_definitions(game-audio-haptics PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN)
target_link_libraries(game-audio-haptics PRIVATE ole32 uuid)
set_target_properties(game-audio-haptics PROPERTIES
  OUTPUT_NAME "game-audio-haptics"
)

if(MSVC)
  # Keep the small native helpers independent of a separately installed
  # Visual C++ redistributable on the end-user PC.
  set_property(TARGET mouse-injector PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
  set_property(TARGET game-audio-haptics PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
endif()
