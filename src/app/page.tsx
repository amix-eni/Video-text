'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, FileText, Sparkles, Download, Loader2, ArrowRight, Check, Copy, X, Trash2, MessageCircle, Send, Bot, User } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [metadata, setMetadata] = useState<{ title: string; channel: string; duration: string; thumbnail: string } | null>(null);

  // Chatbot state
  type ChatMessage = { role: 'user' | 'assistant'; content: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Job progress state
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFetchTranscript = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setTranscript('');
    setSummary('');
    setMetadata(null);
    setChatMessages([]); // Clear chat on new video
    setProgress(0);
    setStatusMessage('Starting...');

    try {
      // 1. Start the job
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const jobId = data.jobId;

      // 2. Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/transcript/status?id=${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.error) {
            clearInterval(pollInterval);
            throw new Error(statusData.error);
          }

          setProgress(statusData.progress);
          setStatusMessage(statusData.message);

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setTranscript(statusData.result.transcript);
            if (statusData.result.metadata) {
              setMetadata(statusData.result.metadata);
            }
            setLoading(false);
          } else if (statusData.status === 'error') {
            clearInterval(pollInterval);
            throw new Error(statusData.error);
          }
        } catch (pollErr: unknown) {
          clearInterval(pollInterval);
          const msg = pollErr instanceof Error ? pollErr.message : 'Polling failed';
          setError(msg);
          setLoading(false);
        }
      }, 2000);

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMsg);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFetchTranscript();
  };

  const handleSummarize = async () => {
    if (!transcript) return;
    setSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (err: unknown) {
      setError('Failed to summarize transcript');
    } finally {
      setSummarizing(false);
    }
  };

  const handleCopy = (text: string, type: 'transcript' | 'summary') => {
    navigator.clipboard.writeText(text);
    if (type === 'transcript') {
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    } else {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleClear = () => {
    setUrl('');
    setTranscript('');
    setSummary('');
    setMetadata(null);
    setError('');
    setChatMessages([]);
    setChatInput('');
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !transcript || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Add user message to chat
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, transcript, metadata }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Add AI response to chat
      setChatMessages([...newMessages, { role: 'assistant', content: data.answer }]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      setChatMessages([...newMessages, { role: 'assistant', content: `Sorry, I encountered an error: ${errorMsg}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    console.log('Starting PDF generation...');
    try {
      const doc = new jsPDF();
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxWidth = pageWidth - margin * 2;
      const pageHeight = doc.internal.pageSize.getHeight();
      let cursorY = 20;

      const checkPageBreak = (neededHeight: number) => {
        if (cursorY + neededHeight > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
          return true;
        }
        return false;
      };

      const addWrappedText = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: number = 0) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(fontSize);
        doc.setTextColor(color);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          checkPageBreak(6);
          doc.text(line, margin, cursorY);
          cursorY += 6;
        });
      };

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246);
      doc.text('YouTube-to-Text Pro', margin, cursorY);
      cursorY += 12;

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, cursorY);
      cursorY += 15;

      if (summary) {
        console.log('Adding summary to PDF...');
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(139, 92, 246);
        doc.text('AI Summary & Insights', margin, cursorY);
        cursorY += 10;

        // Simple Markdown-ish parsing for summary
        const sections = summary.split('\n');
        sections.forEach(section => {
          if (section.startsWith('###')) {
            cursorY += 4;
            addWrappedText(section.replace('###', '').trim(), 14, 'bold', 30);
            cursorY += 2;
          } else if (section.startsWith('##')) {
            cursorY += 6;
            addWrappedText(section.replace('##', '').trim(), 16, 'bold', 20);
            cursorY += 4;
          } else if (section.startsWith('**') && section.endsWith('**')) {
            addWrappedText(section.replace(/\*\*/g, '').trim(), 11, 'bold', 0);
          } else if (section.startsWith('```')) {
            // Skip the fence, but we could handle code blocks here
          } else {
            addWrappedText(section, 11, 'normal', 40);
          }
        });
        cursorY += 10;
      }

      console.log('Adding transcript to PDF...');
      checkPageBreak(25);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(59, 130, 246);
      doc.text('Full Transcript', margin, cursorY);
      cursorY += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      const transcriptLines = doc.splitTextToSize(transcript, maxWidth);
      transcriptLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, margin, cursorY);
        cursorY += 6;
      });

      console.log('Saving PDF...');
      doc.save(`transcript-${new Date().getTime()}.pdf`);
      console.log('PDF saved successfully!');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setError('Failed to generate PDF. Please check the console for details.');
    }
  };

  return (
    <div className="main-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background Blobs */}
      <div className="bg-blob" style={{ background: 'var(--accent-primary)', top: '-100px', left: '-100px' }} />
      <div className="bg-blob" style={{ background: 'var(--accent-secondary)', bottom: '100px', right: '-100px', animationDelay: '-5s' }} />
      <div className="bg-blob" style={{ background: 'var(--accent-tertiary)', top: '40%', right: '20%', width: '300px', height: '300px', opacity: 0.1, animationDuration: '25s' }} />

      {/* Hero Section */}
      <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '6rem', position: 'relative', zIndex: 10 }} className="animate-slide-up">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', padding: '0.6rem 1.25rem', borderRadius: '100px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '2rem' }}
            whileHover={{ scale: 1.05, border: '1px solid rgba(139, 92, 246, 0.4)' }}
          >
            <Sparkles size={16} className="gradient-text" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a78bfa' }}>
              Advanced Llama-3.1 AI Intelligence
            </span>
          </motion.div>
          <h1 style={{ marginBottom: '1.5rem', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            Video to <span className="gradient-text">Genius</span>
          </h1>
          <p style={{ fontSize: '1.35rem', maxWidth: '700px', margin: '0 auto', color: '#94a3b8', lineHeight: '1.6' }}>
            Transform any YouTube video into actionable insights, structured transcripts, and executive summaries in seconds.
          </p>
        </motion.div>

        {/* Search Box */}
        <motion.div
          className="glass-card"
          style={{ maxWidth: '850px', margin: '4rem auto 0', padding: '0.75rem', position: 'relative', zIndex: 20 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          whileHover={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
        >
          <form onSubmit={handleSubmit} className="search-form">
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'none', zIndex: 10 }}>
                <Youtube color="#ef4444" size={24} />
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="Paste YouTube video URL (e.g., https://youtube.com/watch?v=...)"
                style={{ paddingLeft: '4rem', paddingRight: '3.5rem', height: '65px', fontSize: '1.15rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px', zIndex: 10 }}
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0 2.5rem', height: '65px', fontSize: '1.1rem', minWidth: '160px' }}
              disabled={loading || !url}
            >
              {loading ? <Loader2 className="animate-spin" size={26} /> : (
                <>
                  <span>Analyze</span>
                  <ArrowRight size={22} />
                </>
              )}
            </button>
          </form>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: '#f87171', marginTop: '1rem', fontSize: '0.95rem', textAlign: 'left', paddingLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <div style={{ width: '6px', height: '6px', background: '#f87171', borderRadius: '50%' }} />
              {error}
            </motion.p>
          )}

          {loading && !transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: '1.5rem', padding: '0 1rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                <span>{statusMessage || 'Processing...'}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '100px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 50 }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '100px' }}
                />
              </div>
            </motion.div>
          )}

          {!error && !loading && !transcript && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Sparkles size={14} />
              Works with all YouTube videos • Real-time progress updates available
            </motion.p>
          )}
        </motion.div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {transcript && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="animate-slide-up"
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', gap: '1rem' }}>
                <button
                  className="btn-secondary"
                  onClick={handleClear}
                  style={{ color: '#f87171' }}
                >
                  <Trash2 size={18} />
                  Clear All
                </button>
                <button
                  className="btn-primary"
                  style={{ background: '#334155', boxShadow: 'none' }}
                  onClick={handleDownloadPDF}
                >
                  <Download size={18} />
                  Export PDF
                </button>
              </div>

              <div className="content-grid">

                {/* Transcript Column */}
                <div className="glass-card" style={{ height: 'fit-content' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <FileText size={20} style={{ color: '#3b82f6' }} />
                      </div>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Transcript</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleCopy(transcript, 'transcript')}
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        {copiedTranscript ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                        {copiedTranscript ? 'Copied' : 'Copy'}
                      </button>
                      {!summary && (
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                          onClick={handleSummarize}
                          disabled={summarizing}
                        >
                          {summarizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                          AI Summary
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{
                    maxHeight: '550px',
                    overflowY: 'auto',
                    paddingRight: '1rem',
                    whiteSpace: 'pre-wrap',
                    color: '#cbd5e1',
                    fontSize: '1.05rem',
                    lineHeight: '1.8',
                    letterSpacing: '0.01em'
                  }}>
                    {transcript}
                  </div>
                </div>

                {/* Summary Column */}
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card"
                    style={{ border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.02)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                          <Sparkles size={20} style={{ color: '#8b5cf6' }} />
                        </div>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>AI Insights</h3>
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => handleCopy(summary, 'summary')}
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        {copiedSummary ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                        {copiedSummary ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', color: '#f8fafc', fontSize: '1.1rem', lineHeight: '1.8' }}>
                      {summary}
                    </div>
                    <div style={{ marginTop: '2.5rem', padding: '1.25rem', borderRadius: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={20} color="white" />
                      </div>
                      <div>
                        <p style={{ margin: 0, color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>Analysis Complete</p>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Optimized by Llama-3-8B</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Chatbot Column */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card"
                  style={{ border: '1px solid rgba(34, 197, 94, 0.2)', background: 'rgba(34, 197, 94, 0.02)', display: 'flex', flexDirection: 'column', height: '600px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <MessageCircle size={20} style={{ color: '#22c55e' }} />
                      </div>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Chat with Video</h3>
                    </div>
                    {chatMessages.length > 0 && (
                      <button
                        className="btn-secondary"
                        onClick={() => setChatMessages([])}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Clear Chat
                      </button>
                    )}
                  </div>

                  {/* Chat Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                    {chatMessages.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                        <Bot size={48} style={{ opacity: 0.3 }} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Ask me anything about this video!</p>
                          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Try: "What is the main topic?\" or \"Summarize the key points\"</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {chatMessages.map((msg, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                              display: 'flex',
                              gap: '0.75rem',
                              alignItems: 'flex-start',
                              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: msg.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #22c55e, #10b981)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {msg.role === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
                            </div>
                            <div style={{
                              background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                              padding: '0.75rem 1rem',
                              borderRadius: '12px',
                              maxWidth: '80%',
                              border: msg.role === 'user' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)'
                            }}>
                              <p style={{ margin: 0, color: '#f8fafc', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {msg.content}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                        {chatLoading && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #22c55e, #10b981)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Bot size={16} color="white" />
                            </div>
                            <div style={{
                              background: 'rgba(34, 197, 94, 0.1)',
                              padding: '0.75rem 1rem',
                              borderRadius: '12px',
                              border: '1px solid rgba(34, 197, 94, 0.2)'
                            }}>
                              <Loader2 className="animate-spin" size={18} style={{ color: '#22c55e' }} />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ask a question about the video..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatLoading}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        fontSize: '0.95rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: '12px'
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={!chatInput.trim() || chatLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #22c55e, #10b981)',
                        minWidth: 'auto'
                      }}
                    >
                      {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </form>
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer style={{ marginTop: '6rem', padding: '3rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem' }}>© 2026 YouTube-to-Text Pro. Powered by Next.js & Llama-3.</p>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>Privacy Policy</a>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>Terms of Service</a>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>API Contact</a>
        </div>
      </footer>
    </div>
  );
}

