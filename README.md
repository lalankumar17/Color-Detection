# RGB-Color-Detection-Using-CNN-KNN
This project focuses on developing a color detection application using 
Python, OpenCV, and pandas. The application allows users ***to identify the 
name of a color in an image by double clicking on it***. The process involves 
reading a CSV file containing color names and their corresponding RGB 
values into a pandas DataFrame. An image is loaded and resized using 
OpenCV for easier handling. The core functionality is split into two main 
functions: get_color_name and draw_function. 
The get_color_name function calculates the closest color name from the 
DataFrame based on the RGB values of the clicked pixel. It iterates 
through the DataFrame, computing the distance between the clicked 
pixel's RGB values and those in the DataFrame, and returns the name of 
the color with the minimum distance. 
The draw_function is designed to capture the x, y coordinates of a mouse 
double-click event on the image, updating global variables that track the 
position and RGB values of the clicked pixel. 
This application shows how to use Python, OpenCV, and pandas to detect 
colors in an image, a simple task for humans but complex for computers. 
It highlights using image processing and managing user interactions in a 
graphical interface.

# Installation!
Must have python environment setup in your system

```bash
pip install pandas
```
```bash
pip install opencv-python
```
```bash
pip install scikit-learn
```

# Snapshots
![Screenshot 2024-07-18 150819](https://github.com/user-attachments/assets/635f17c6-d9d4-4670-a1b3-bf992d896388)
