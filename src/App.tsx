import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ExamPage from "@/pages/ExamPage";
import AdminPage from "@/pages/AdminPage";
import ConfidentialitePage from "@/pages/ConfidentialitePage";
import EvolutionPage from "@/pages/EvolutionPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ds/:id" element={<ExamPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/evolution" element={<EvolutionPage />} />
        <Route path="/confidentialite" element={<ConfidentialitePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
