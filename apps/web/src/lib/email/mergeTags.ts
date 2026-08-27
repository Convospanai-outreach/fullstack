interface MergeTagLead {
  fullName?: string | null;
  email?: string | null;
  company?: string | null;
  jobTitle?: string | null;
}

function firstName(fullName?: string | null): string {
  return fullName?.trim().split(/\s+/)[0] || "";
}

function lastName(fullName?: string | null): string {
  const parts = fullName?.trim().split(/\s+/) || [];
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

export function renderMergeTags(template: string, lead: MergeTagLead): string {
  const values: Record<string, string> = {
    firstName: firstName(lead.fullName),
    lastName: lastName(lead.fullName),
    fullName: lead.fullName || "",
    company: lead.company || "",
    jobTitle: lead.jobTitle || "",
    email: lead.email || "",
  };

  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] as string : match;
  });
}
