import math
import random

class MyClass:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def add(self):
        return self.x + self.y

    def subtract(self):
        return self.x - self.y

def my_function(a, b):
    if a > b:
        return a * b
    elif a < b:
        return a / b
    else:
        return a + b

def main():
    obj = MyClass(5, 3)
    print("Add:", obj.add())
    print("Subtract:", obj.subtract())

    a = random.randint(1, 10)
    b = random.randint(1, 10)
    print("Function result:", my_function(a, b))

if __name__ == "__main__":
    main()