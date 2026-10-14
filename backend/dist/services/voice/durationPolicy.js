export function narrationFitsTarget(measured, target) {
    return Number.isFinite(measured) && Number.isFinite(target) && target > 0 && measured > 0 && Math.abs(measured - target) <= Math.max(3, target * 0.3);
}
