export function useAuth() {
  return { isSignedIn: true, isLoaded: true, userId: "preview-user" };
}

export function useUser() {
  return {
    isSignedIn: true,
    isLoaded: true,
    user: { firstName: "Preview", lastName: "User", fullName: "Preview User" },
  };
}
