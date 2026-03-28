FROM python:3.10-slim

WORKDIR /app

# Install dependencies: pyboy for emulation and Pillow for screen image extraction
RUN pip install --no-cache-dir pyboy Pillow

# Copy the newly refactored src tree
COPY src /app/src

# Define where the state folder will be mounted
ENV STATE_DIR=/app/state

# Run the python script by default when container starts
CMD ["python", "src/main.py"]
