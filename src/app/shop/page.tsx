'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function ShopPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'shopkeeper', content: string, emotion?: string }>>([
    { role: 'shopkeeper', content: "Welcome to the Game Shop! What kind of game are you looking for today?", emotion: 'excited' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input } as const;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/shop/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      
      if (data.action === 'create_game') {
        setMessages(prev => [
          ...prev,
          { role: 'shopkeeper', content: "Creating game...", emotion: 'thinking' }
        ]);
        
        // Simulate creation process
        setTimeout(() => {
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'shopkeeper', content: "Game created! Check your inventory.", emotion: 'excited' }
          ]);
        }, 2000);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'shopkeeper', content: data.response, emotion: data.emotion }
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'shopkeeper', content: "Sorry, I'm having trouble right now.", emotion: 'thinking' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([
      { role: 'shopkeeper', content: "Welcome to the Game Shop! What kind of game are you looking for today?", emotion: 'excited' }
    ]);
  };

  const getEmotionIndicator = (emotion?: string) => {
    if (emotion === 'excited') {
      return <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-cyan animate-pulse"></div>;
    }
    if (emotion === 'thinking') {
      return <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1 h-1 rounded-full bg-purple animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}></div>
        ))}
      </div>;
    }
    return null;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Shop Scene - Left Side */}
      <div className="w-3/5 h-full relative overflow-hidden" style={{ background: 'var(--bg-void)' }}>
        {/* Sunset Background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, #ff9a3d 0%, #ff5e62 40%, #1f1c2c 100%)'
          }}
        ></div>

        {/* Shop Counter */}
        <div 
          className="absolute bottom-1/3 w-full h-24"
          style={{ background: 'linear-gradient(to right, #2d1b69 0%, #4a378f 50%, #2d1b69 100%)' }}
        >
          {/* Shelves */}
          <div className="absolute top-4 left-0 right-0 h-16 flex justify-between px-8">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i}
                className="relative"
                style={{
                  width: '60px',
                  height: '100%',
                  background: `linear-gradient(to right, ${['#ff5e62', '#00c9ff', '#834d9b', '#f093fb', '#f5576c'][i]} 0%, ${['#ff5e62', '#00c9ff', '#834d9b', '#f093fb', '#f5576c'][i]} 100%)`,
                  border: '2px solid var(--cyan)',
                  boxShadow: `0 0 8px ${['#ff5e62', '#00c9ff', '#834d9b', '#f093fb', '#f5576c'][i]}`,
                  borderRadius: '4px'
                }}
              >
                <div 
                  className="absolute inset-1"
                  style={{
                    background: `linear-gradient(to right, ${['#ff5e62', '#00c9ff', '#834d9b', '#f093fb', '#f5576c'][i]} 0%, ${['#ff5e62', '#00c9ff', '#834d9b', '#f093fb', '#f5576c'][i]} 100%)`,
                    opacity: 0.3,
                    borderRadius: '2px'
                  }}
                ></div>
              </div>
            ))}
          </div>

          {/* Shopkeeper */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-4">
            <div className="relative">
              {/* Gino's Head */}
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ 
                  background: '#2d1b69',
                  border: '3px solid var(--cyan)',
                  boxShadow: '0 0 12px var(--cyan)'
                }}
              >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-black"></div>
                </div>
              </div>

              {/* Gino's Body */}
              <div 
                className="absolute top-16 left-1/2 transform -translate-x-1/2 w-10 h-8"
                style={{ 
                  background: '#4a378f',
                  border: '2px solid var(--cyan)',
                  borderRadius: '4px 4px 0 0'
                }}
              ></div>

              {/* Mustache */}
              <div 
                className="absolute top-10 left-1/2 transform -translate-x-1/2 w-8 h-2"
                style={{ 
                  background: '#000',
                  borderRadius: '50%'
                }}
              ></div>

              {/* Speech Bubble */}
              <div 
                className="absolute top-20 left-1/2 transform -translate-x-1/2 w-32 h-16 flex items-center justify-center"
                style={{ 
                  background: '#0f0c29',
                  border: '2px solid var(--purple)',
                  borderRadius: '10px',
                  boxShadow: '0 0 8px var(--purple)'
                }}
              >
                <div className="text-white text-xs px-2">
                  {messages[messages.length - 1]?.content || "Hello!"}
                </div>
              </div>

              {/* Emotion Indicator */}
              {getEmotionIndicator(messages[messages.length - 1]?.emotion)}
            </div>
          </div>
        </div>

        {/* Floating Notification */}
        {messages.some(m => m.content === "Creating game...") && (
          <div 
            className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-48 h-10 flex items-center justify-center"
            style={{ 
              background: 'var(--green)',
              border: '2px solid var(--cyan)',
              borderRadius: '8px',
              boxShadow: '0 0 12px var(--green)',
              animation: 'pulse 1.5s infinite'
            }}
          >
            <span className="text-white font-bold">Creating game...</span>
          </div>
        )}
      </div>

      {/* Chat Panel - Right Side */}
      <div className="w-2/5 h-full flex flex-col" style={{ background: 'var(--bg-void)' }}>
        <div 
          className="p-4 flex justify-between items-center"
          style={{ borderBottom: '2px solid var(--cyan)' }}
        >
          <h1 className="text-cyan font-bold text-lg">GAME SHOP // GINO</h1>
          <button 
            onClick={resetChat}
            className="px-3 py-1 text-xs bg-purple border border-purple rounded hover:bg-purple/20 transition"
          >
            Reset
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div 
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-xs p-3 rounded-lg ${msg.role === 'user' ? 'border border-cyan text-cyan' : 'border border-purple text-purple'}`}
                style={{ 
                  background: msg.role === 'user' ? 'rgba(0, 201, 255, 0.1)' : 'rgba(131, 77, 155, 0.1)',
                  backdropFilter: 'blur(4px)'
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-cyan">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 bg-transparent border border-cyan rounded focus:outline-none focus:ring-1 focus:ring-cyan"
              disabled={loading}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan text-black font-bold rounded hover:bg-white transition"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}