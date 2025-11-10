import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Invitations from "./pages/Invitations";
import InvitationPage from "./pages/InvitationPage";
import DiagramEditor from "./pages/DiagramEditor";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/invitations" element={<Invitations />} />
      <Route path="/invitation/:invitationId" element={<InvitationPage />} />
      <Route path="/diagrams" element={<DiagramEditor />} />
      <Route path="/diagrams/:id" element={<DiagramEditor />} />
    </Routes>
  );
}

export default App;
