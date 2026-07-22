import { Route, Routes } from 'react-router-dom';
import { SiteLayout } from '../components/SiteLayout';
import { About } from '../content/pages/About';
import { Contact } from '../content/pages/Contact';
import { Home } from '../content/pages/Home';
import { NotFound } from '../content/pages/NotFound';
import { Writing } from '../content/pages/Writing';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="writing" element={<Writing />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
