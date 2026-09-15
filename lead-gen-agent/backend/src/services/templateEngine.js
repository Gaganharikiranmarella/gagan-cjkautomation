// Fills {{tokens}} in a message template with fields from a lead. Unknown
// tokens are left as-is rather than silently dropped, so a typo in a
// template is obvious in the preview instead of vanishing.
const TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}

function renderTemplate(template, lead) {
  const values = {
    name: lead.name || '',
    firstName: firstName(lead.name),
    company: lead.company || '',
    email: lead.email || '',
    phone: lead.phone || '',
  };

  return String(template || '').replace(TOKEN_PATTERN, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  ));
}

const AVAILABLE_TOKENS = ['name', 'firstName', 'company', 'email', 'phone'];

module.exports = { renderTemplate, AVAILABLE_TOKENS };
