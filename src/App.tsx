import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Size from "./pages/Size";
import Results from "./pages/Results";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/size" replace />} />
        <Route path="/size" element={<Size />} />
        <Route path="/results" element={<Results />} />
        <Route path="*" element={<Navigate to="/size" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
