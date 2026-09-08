export function addBodyAttributes(html, bodyAttributes) {
  const attributes = String(bodyAttributes || "").trim();
  if (!attributes) return html;
  return html.replace(/<body([^>]*)>/, (_tag, existing) => `<body${existing} ${attributes}>`);
}
