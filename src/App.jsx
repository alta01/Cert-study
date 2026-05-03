import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExamProvider } from './context/ExamContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Home from './pages/Home.jsx';
import ExamPage from './pages/ExamPage.jsx';
import StudyMode from './pages/StudyMode.jsx';
import Admin from './pages/Admin.jsx';
import Results from './components/Results/Results.jsx';

export default function App() {
  return (
    <ExamProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="exam/:examSlug" element={<ExamPage />} />
            <Route path="study/:examSlug" element={<StudyMode />} />
            <Route path="results" element={<Results />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ExamProvider>
  );
}
