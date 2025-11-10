import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./css/Auth.css";

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const suggestedEmail = searchParams.get("email") || "";

  useEffect(() => {
    // Si ya está logueado, redirigir directamente
    const user = localStorage.getItem("user");
    if (user) {
      navigate(redirectTo);
    }

    // Pre-llenar el email si viene de una invitación
    if (suggestedEmail) {
      setEmail(suggestedEmail);
    }
  }, [navigate, redirectTo, suggestedEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Register attempt:", { name, email, password: "***" });

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("Register successful:", data.user);
        // Guardar usuario en localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate(redirectTo);
      } else {
        console.error("Register failed:", data.error);
        alert(data.error || "Error al crear la cuenta");
      }
    } catch (error) {
      console.error("Register error:", error);
      alert("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Crear Cuenta</h1>
          <p>Únete a la plataforma de diagramas UML</p>
          {redirectTo.includes("/invitation/") && (
            <div className="invitation-notice">
              <p>
                Has sido invitado a colaborar en un diagrama. Crea tu cuenta
                para aceptar la invitación.
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Nombre Completo</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Tu nombre completo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Tu contraseña"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Contraseña</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirma tu contraseña"
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>
        </form>

        <div className="auth-links">
          <p>
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="auth-link">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
