export function Spacer({ className = "", width, height, backgroundColor }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;
  if (backgroundColor) style.backgroundColor = backgroundColor;
  return <div className={`flex-1 ${className}`.trim()} style={style} />;
}
