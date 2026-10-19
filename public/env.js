// EstateFlow app - runtime configuration (a web build can be re-pointed without rebuilding).
// apiUrl: address of the EstateFlow API, without a trailing slash and without /api.
// Inside the Android app the address can also be changed from the sign-in screen.
// websiteUrl: the dashboard's address, which also serves the public website; used by "Share" on
//   published properties (links look like <websiteUrl>/homes/<slug>).
window.ESTATEFLOW_CONFIG = {
  apiUrl: '',
  websiteUrl: '',
};
