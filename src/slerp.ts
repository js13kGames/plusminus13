function slerpy(
  startAngle: number,
  endAngle: number,
  startMagnitude: number,
  endMagnitude: number,
  t: number,
) {
  const angle = startAngle + (endAngle - startAngle) * t;
  const magnitude = startMagnitude + (endMagnitude - startMagnitude) * t;
  return { angle, magnitude };
}
export default slerpy;
