// quick_example.cpp
#include <emscripten/bind.h>

using namespace emscripten;

float plus(float a, float b)
{
    return a + b;
}

EMSCRIPTEN_BINDINGS(my_module)
{
    function("plus", &plus);
}