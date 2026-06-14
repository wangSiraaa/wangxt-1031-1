import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Issues from '@/pages/Issues'
import IssueNew from '@/pages/IssueNew'
import IssueDetail from '@/pages/IssueDetail'
import Assignment from '@/pages/Assignment'
import Reinspection from '@/pages/Reinspection'
import Approval from '@/pages/Approval'
import Overdue from '@/pages/Overdue'
import Recurrent from '@/pages/Recurrent'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/issues/new" element={<IssueNew />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/assignment" element={<Assignment />} />
          <Route path="/reinspection" element={<Reinspection />} />
          <Route path="/approval" element={<Approval />} />
          <Route path="/overdue" element={<Overdue />} />
          <Route path="/recurrent" element={<Recurrent />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  )
}
