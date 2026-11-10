# Camera inference fixture

astronaut.png is the scikit-image astronaut example, downloaded from:
https://raw.githubusercontent.com/scikit-image/scikit-image/v0.18.3/skimage/data/astronaut.png

The image is a NASA photograph of astronaut Eileen Collins and is provided as public-domain data by scikit-image:
https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut

The browser tests feed this public fixture into a generated MediaStream to exercise the real local face detector. It is not a user camera recording. The fixture is never rendered in the application UI or sent to the room server.
