import { useState } from 'react'
import { Phone, Mail, MapPin, Send } from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'

export default function Contact() {
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    showToast('Thanks for reaching out! Our team will get back to you shortly.')
    setForm({ name: '', email: '', message: '' })
  }

  return (
    <div className="container-page py-16">
      <div className="text-center mb-12">
        <span className="text-ember-600 font-semibold text-sm uppercase tracking-wide">Get In Touch</span>
        <h1 className="text-4xl font-semibold mt-2">We'd Love to Hear From You</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 max-w-4xl mx-auto">
        <div className="space-y-5">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ember-50 text-ember-600 flex items-center justify-center shrink-0"><Phone size={20} /></div>
            <div>
              <div className="font-semibold text-sm">Call Us</div>
              <div className="text-sm text-ink-950/60">0800-36364</div>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ember-50 text-ember-600 flex items-center justify-center shrink-0"><Mail size={20} /></div>
            <div>
              <div className="font-semibold text-sm">Email Us</div>
              <div className="text-sm text-ink-950/60">support@foodhub.pk</div>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ember-50 text-ember-600 flex items-center justify-center shrink-0"><MapPin size={20} /></div>
            <div>
              <div className="font-semibold text-sm">Visit Us</div>
              <div className="text-sm text-ink-950/60">Shahrah-e-Faisal, Karachi</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label-field">Your Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Email Address</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Message</label>
            <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field" />
          </div>
          <button type="submit" className="btn-primary w-full py-3"><Send size={16} /> Send Message</button>
        </form>
      </div>
    </div>
  )
}
