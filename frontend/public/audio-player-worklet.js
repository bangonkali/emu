class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 262144;
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.availableFrames = 0;
    this.readPhase = 0;
    this.sourceSampleRate = sampleRate;
    this.channels = 2;

    this.port.onmessage = (event) => {
      const message = event.data ?? {};
      switch (message.type) {
        case 'chunk':
          this.enqueueChunk(message.payload);
          break;
        case 'config':
          this.sourceSampleRate = Number(message.sourceSampleRate) || sampleRate;
          this.channels = Math.max(1, Number(message.channels) || 2);
          break;
        case 'reset':
          this.reset();
          break;
      }
    };
  }

  reset() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.availableFrames = 0;
    this.readPhase = 0;
  }

  discardFrames(frameCount) {
    if (frameCount <= 0) {
      return;
    }

    if (frameCount >= this.availableFrames) {
      this.reset();
      return;
    }

    this.readIndex = (this.readIndex + frameCount) % this.capacity;
    this.availableFrames -= frameCount;
    if (this.availableFrames < 2) {
      this.readPhase = 0;
    }
  }

  writeFrame(leftSample, rightSample) {
    this.left[this.writeIndex] = leftSample;
    this.right[this.writeIndex] = rightSample;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;

    if (this.availableFrames < this.capacity) {
      this.availableFrames += 1;
      return;
    }

    this.readIndex = (this.readIndex + 1) % this.capacity;
  }

  enqueueChunk(payload) {
    if (!(payload instanceof ArrayBuffer) || payload.byteLength === 0) {
      return;
    }

    const samples = new Int8Array(payload);
    const frameCount = Math.floor(samples.length / this.channels);
    if (frameCount <= 0) {
      return;
    }

    const overflow = Math.max(0, this.availableFrames + frameCount - this.capacity + 1);
    this.discardFrames(overflow);

    for (let frame = 0; frame < frameCount; frame += 1) {
      const offset = frame * this.channels;
      const leftSample = samples[offset] / 128;
      const rightSample = this.channels > 1 ? samples[offset + 1] / 128 : leftSample;
      this.writeFrame(leftSample, rightSample);
    }
  }

  peek(buffer, offset) {
    return buffer[(this.readIndex + offset) % this.capacity];
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }

    const leftChannel = output[0];
    const rightChannel = output[1] ?? output[0];
    const step = this.sourceSampleRate / sampleRate;

    for (let index = 0; index < leftChannel.length; index += 1) {
      while (this.availableFrames > 1 && this.readPhase >= 1) {
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.availableFrames -= 1;
        this.readPhase -= 1;
      }

      if (this.availableFrames > 1) {
        const fraction = this.readPhase;
        const leftA = this.peek(this.left, 0);
        const leftB = this.peek(this.left, 1);
        const rightA = this.peek(this.right, 0);
        const rightB = this.peek(this.right, 1);

        leftChannel[index] = leftA + (leftB - leftA) * fraction;
        rightChannel[index] = rightA + (rightB - rightA) * fraction;
        this.readPhase += step;
      } else {
        leftChannel[index] = 0;
        rightChannel[index] = 0;
        this.readPhase = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-player', PCMPlayerProcessor);