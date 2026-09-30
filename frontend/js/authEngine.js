/**
 * NWIS - Nearby Well Intelligence System
 * Authentication Engine & Role-Based Access Controller
 * Ministry of Petroleum & Natural Gas | Oil India Limited
 */

(function () {
  const BACKEND_BASE = "http://localhost:8000/api/v1/auth";

  // Fallback roles in case backend call is delayed
  const DEFAULT_ROLES = [
    {
      id: "drilling_engineer",
      role: "drilling_engineer",
      title: "Drilling Engineer",
      subtitle: "Operate • Monitor • Analyze",
      default_username: "drilling_engineer",
      default_password: "password123",
      full_name: "Er. Rakesh Sharma",
      icon: "engineer"
    },
    {
      id: "supervisor",
      role: "drilling_supervisor",
      title: "Supervisor",
      subtitle: "Monitor • Approve • Take Action",
      default_username: "drilling_supervisor",
      default_password: "password123",
      full_name: "Er. Rajiv Bordoloi",
      icon: "supervisor"
    },
    {
      id: "administrator",
      role: "admin",
      title: "Administrator",
      subtitle: "Manage Users • System Oversight",
      default_username: "admin",
      default_password: "adminpassword123",
      full_name: "System Administrator",
      icon: "admin"
    }
  ];

  let availableRoles = [...DEFAULT_ROLES];
  let selectedRole = DEFAULT_ROLES[0]; // Drilling Engineer default

  document.addEventListener("DOMContentLoaded", () => {
    initAuthEngine();
  });

  async function initAuthEngine() {
    setupLoginMode();
    await fetchRolesFromBackend();
    bindRoleCardListeners();
    bindFormListeners();
    bindSignOutListener();
    selectRole(availableRoles[0].role); // Default to Drilling Engineer
  }

  function setupLoginMode() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem("nwis_user") || localStorage.getItem("wigms_user");
    const savedToken = localStorage.getItem("nwis_access_token") || localStorage.getItem("wigms_access_token");

    if (savedUser && savedToken) {
      try {
        const userObj = JSON.parse(savedUser);
        applyUserProfile(userObj);
        if (window.applyRoleCustomizations) {
          window.applyRoleCustomizations(userObj.role);
        }
        document.body.classList.remove("login-mode");
        return;
      } catch (e) {
        console.warn("Invalid saved user session:", e);
      }
    }

    // Default: Show login screen
    document.body.classList.add("login-mode");
  }

  async function fetchRolesFromBackend() {
    try {
      const resp = await fetch(`${BACKEND_BASE}/roles`, {
        headers: { "Content-Type": "application/json" }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          availableRoles = data;
        }
      }
    } catch (err) {
      console.warn("Backend auth roles fetch notice (using robust local fallback):", err);
    }
  }

  function bindRoleCardListeners() {
    const roleCards = document.querySelectorAll(".login-role-card");
    roleCards.forEach(card => {
      card.addEventListener("click", () => {
        const roleKey = card.getAttribute("data-role");
        selectRole(roleKey);
      });
    });
  }

  function selectRole(roleKey) {
    const found = availableRoles.find(r => r.role === roleKey || r.id === roleKey) || availableRoles[0];
    selectedRole = found;

    // Update active class on role cards
    const roleCards = document.querySelectorAll(".login-role-card");
    roleCards.forEach(card => {
      const cRole = card.getAttribute("data-role");
      if (cRole === found.role || cRole === found.id) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });

    // Populate input fields with credentials from backend/roles
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    if (usernameInput) {
      usernameInput.value = found.default_username || found.role;
    }
    if (passwordInput) {
      passwordInput.value = found.default_password || "password123";
    }

    // Clear any previous error message
    hideErrorMessage();
  }

  function bindFormListeners() {
    const form = document.getElementById("loginForm");
    const pwdToggle = document.getElementById("togglePasswordVisibility");
    const passwordInput = document.getElementById("loginPassword");

    if (pwdToggle && passwordInput) {
      pwdToggle.addEventListener("click", () => {
        const isPwd = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPwd ? "text" : "password");
        pwdToggle.setAttribute("aria-label", isPwd ? "Hide password" : "Show password");
        pwdToggle.classList.toggle("showing-text", isPwd);
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleLoginSubmit();
      });
    }

    // Enter key support
    const usernameInput = document.getElementById("loginUsername");
    [usernameInput, passwordInput].forEach(inp => {
      if (inp) {
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleLoginSubmit();
          }
        });
      }
    });
  }

  async function handleLoginSubmit() {
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const btnSubmit = document.getElementById("btnSubmitLogin");
    const btnText = document.getElementById("btnSubmitText");
    const btnSpinner = document.getElementById("btnSubmitSpinner");

    const username = (usernameInput ? usernameInput.value : "").trim();
    const password = (passwordInput ? passwordInput.value : "").trim();

    if (!username || !password) {
      showErrorMessage("Please enter both username and password.");
      return;
    }

    hideErrorMessage();

    // UI Loading state
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = "Verifying Credentials...";
    if (btnSpinner) btnSpinner.classList.remove("hidden");

    try {
      const resp = await fetch(`${BACKEND_BASE}/login-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        const errMsg = data.detail || "Authentication failed. Please verify credentials.";
        showErrorMessage(errMsg);
        return;
      }

      // Successful authentication
      const user = data.user;
      localStorage.setItem("nwis_access_token", data.access_token);
      localStorage.setItem("nwis_user", JSON.stringify(user));
      localStorage.setItem("wigms_access_token", data.access_token);
      localStorage.setItem("wigms_user", JSON.stringify(user));

      applyUserProfile(user);

      // Transition to Dashboard
      document.body.classList.remove("login-mode");

      // Notify user
      if (window.showToast) {
        window.showToast(`Logged in as ${user.full_name} (${user.role_title})`);
      }

      // Ensure active page is refreshed/sized properly
      if (window.switchAppTab) {
        // All pages remain visible for all 3 roles as requested
        // Default landing can be alerts/assessment or previous
        window.switchAppTab("alerts");
      }
    } catch (err) {
      console.error("Login request error:", err);
      // Fallback local auth verification if backend network glitch occurs
      const matched = availableRoles.find(
        r => (r.default_username === username || r.role === username) && (r.default_password === password || password === "password123")
      );
      if (matched) {
        const mockUser = {
          id: matched.id,
          username: matched.default_username,
          role: matched.role,
          role_title: matched.title,
          full_name: matched.full_name,
          email: `${matched.role}@oilindia.in`
        };
        localStorage.setItem("nwis_access_token", "demo_jwt_token_" + Date.now());
        localStorage.setItem("nwis_user", JSON.stringify(mockUser));
        localStorage.setItem("wigms_access_token", "demo_jwt_token_" + Date.now());
        localStorage.setItem("wigms_user", JSON.stringify(mockUser));
        applyUserProfile(mockUser);
        document.body.classList.remove("login-mode");
        if (window.showToast) {
          window.showToast(`Logged in as ${mockUser.full_name} (${mockUser.role_title})`);
        }
      } else {
        showErrorMessage("Unable to connect to auth server or invalid credentials.");
      }
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnText) btnText.innerHTML = `&rarr; &nbsp; Sign In`;
      if (btnSpinner) btnSpinner.classList.add("hidden");
    }
  }

  function applyUserProfile(user) {
    const nameEl = document.querySelector(".top-header .user-name");
    const roleEl = document.querySelector(".top-header .user-role");
    const rigEl = document.querySelector(".top-header .user-rig");
    const avatarEl = document.querySelector(".top-header .user-avatar");

    if (nameEl) nameEl.textContent = user.full_name || "Authorized User";
    if (roleEl) roleEl.textContent = user.role_title || formatRoleTitle(user.role);
    if (rigEl) {
      if (user.role === "admin") {
        rigEl.textContent = "DGBOI Basin HQ";
      } else if (user.role === "drilling_supervisor") {
        rigEl.textContent = "Supervisory Command Desk";
      } else {
        rigEl.textContent = "Nahorkatiya Rig-A";
      }
    }

    if (avatarEl) {
      const parts = (user.full_name || "AU").split(" ");
      let initials = "";
      if (parts.length >= 2) {
        initials = parts[0][0] + parts[1][0];
      } else {
        initials = (user.full_name || "AU").substring(0, 2).toUpperCase();
      }
      avatarEl.textContent = initials;
      avatarEl.title = `${user.full_name} (${user.role_title || user.role})`;
    }

    if (window.applyRoleCustomizations) {
      window.applyRoleCustomizations(user.role);
    }
  }

  function formatRoleTitle(role) {
    if (role === "drilling_engineer") return "Drilling Engineer";
    if (role === "drilling_supervisor") return "Supervisor";
    if (role === "admin") return "Administrator";
    return "Operator";
  }

  function showErrorMessage(msg) {
    const errBox = document.getElementById("loginErrorMessage");
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove("hidden");
    }
  }

  function hideErrorMessage() {
    const errBox = document.getElementById("loginErrorMessage");
    if (errBox) {
      errBox.classList.add("hidden");
      errBox.textContent = "";
    }
  }

  function bindSignOutListener() {
    const signOutBtn = document.getElementById("btnSignOut");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => {
        signOutUser();
      });
    }
  }

  function signOutUser() {
    localStorage.removeItem("nwis_access_token");
    localStorage.removeItem("nwis_user");
    localStorage.removeItem("wigms_access_token");
    localStorage.removeItem("wigms_user");
    document.body.classList.add("login-mode");
    selectRole("drilling_engineer");
    if (window.applyRoleCustomizations) {
      window.applyRoleCustomizations("drilling_engineer");
    }
    if (window.showToast) {
      window.showToast("Signed out. Please select role to sign in.");
    }
  }

  // Expose to window for testing or direct invocation
  window.nwisAuth = window.wigmsAuth = {
    signOut: signOutUser,
    selectRole: selectRole,
    getAvailableRoles: () => availableRoles
  };
})();
