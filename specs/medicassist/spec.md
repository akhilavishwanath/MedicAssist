# MedicAssist Specification

## Feature

Offline conversion of unstructured medical audio and text into structured FHIR R4 JSON.

## Goal

Enable field medics to document patient information without internet connectivity using CPU-only AI.

## Inputs

- Audio recording
- Manual text

## Outputs

- Valid FHIR R4 Bundle
- JSON export

## Success Criteria

- Offline execution
- CPU-only inference
- Valid FHIR R4 output
- Local storage using IndexedDB