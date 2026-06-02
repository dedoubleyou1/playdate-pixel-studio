# Pattern Coordinate Contract

Pattern swatches store a swatch reference in pixel data. They do not stamp a fixed bitmap into the layer until an explicit rasterization command does so.

## Sample Space

- Root pixel layers sample pattern swatches in root layer coordinates.
- Object pixel layers sample pattern swatches in object-local coordinates.
- Object instances move object-local pattern samples with the object because the source object is composed before instance placement.
- Moving pattern swatch refs within a root layer or object layer changes their sample coordinates and may shift the visible pattern phase.

## Previews

Move previews must resolve pattern swatches at the destination sample point. The preview should match the committed result, not preserve the source pixel phase.

## Rasterization

Rasterization freezes the current visual output by resolving selected swatch refs through the palette at each sample point and replacing them with solid swatch refs.
