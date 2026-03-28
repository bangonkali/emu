FROM python:3.10-slim

WORKDIR /app

# Install dependencies: pyboy for emulation, Pillow for screen image extraction,
# websockets for the debug server, and pytest for in-container verification.
RUN pip install --no-cache-dir pyboy Pillow websockets pytest

# Copy the newly refactored src tree
COPY src /app/src
COPY tests /app/tests

# Define where the state folder will be mounted
ENV STATE_DIR=/app/state

EXPOSE 8765

# Run the python script by default when container starts
CMD ["python", "src/main.py", "--speed", "1x", "--port", "8765"]
