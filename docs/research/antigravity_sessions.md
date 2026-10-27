# AntiGravity Session Storage Findings

## Overview
Investigation into discrepancies between VibeAllDay session visibility and AntiGravity storage.

## Findings

### 1. Storage Location
*   **VibeAllDay**: Scans `~/.gemini/tmp` (specifically project hash directories).
*   **AntiGravity**: Stores sessions in `~/.gemini/antigravity/conversations`.

### 2. File Format
*   **VibeAllDay**: Expects JSON files (`session-*.json`) with a specific schema.
*   **AntiGravity**: Uses Protocol Buffers (`*.pb`) with UUID filenames.

## Conclusion
VibeAllDay does not currently support AntiGravity sessions due to mismatches in both storage location and file format (JSON vs Protobuf).
