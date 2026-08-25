import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Home from './pages/Home';
import Record from './pages/Record';
import SessionEditor from './pages/SessionEditor';
import Analytics from './pages/Analytics';
import Meals from './pages/Meals';
import Profile from './pages/Profile';
import RoutineEditor from './pages/RoutineEditor';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<Record />} />
        <Route path="/record/session/:id" element={<SessionEditor />} />
        <Route path="/routines/new" element={<RoutineEditor />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/meals" element={<Meals />} />
        <Route path="/me" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
