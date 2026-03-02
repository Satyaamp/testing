// Check if JWT token exists
const token = localStorage.getItem("token");

if (!token) {
  // Not logged in → redirect to login
  window.location.href = "/";
}
