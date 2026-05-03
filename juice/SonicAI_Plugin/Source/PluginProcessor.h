#pragma once

#include <JuceHeader.h>

class SonicAIAudioProcessor  : public juce::AudioProcessor
{
public:
    SonicAIAudioProcessor();
    ~SonicAIAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Sonic AI"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int index) override {}
    const juce::String getProgramName (int index) override { return {}; }
    void changeProgramName (int index, const juce::String& newName) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

private:
    float lastBpm = 120.0f;
    bool roomAcousticsEnabled = false;
    
    // DSP Components (Placeholders for JUCE DSP module classes)
    void updateParametersFromDAW();
    void applyEQFilter(float* channelData, int numSamples);
    void applyRoomConvolution(juce::AudioBuffer<float>& buffer);
    void updateSpectralAnalysis(juce::AudioBuffer<float>& buffer);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SonicAIAudioProcessor)
};
