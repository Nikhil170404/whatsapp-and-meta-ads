"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Simple markdown-to-JSX parser for a premium look without extra dependencies
  const lines = content.split('\n');
  let inList = false;
  let inTable = false;

  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      {lines.map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mt-12 mb-8 leading-tight italic">{line.replace('# ', '')}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter mt-10 mb-6 flex items-center gap-3">
            <span className="w-1.5 h-8 bg-primary rounded-full" />
            {line.replace('## ', '')}
          </h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-xl font-black text-slate-900 tracking-tight mt-8 mb-4">{line.replace('### ', '')}</h3>;
        }

        // Bold & Italic
        const formattedLine = line
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-slate-900">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded-md font-mono text-sm text-primary">$1</code>');

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-3 mb-3 ml-2">
              <div className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <p className="text-slate-600 font-bold leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} />
            </div>
          );
        }

        if (/^\d+\. /.test(line)) {
            const num = line.match(/^\d+/)?.[0];
            return (
              <div key={index} className="flex items-start gap-3 mb-3 ml-2">
                <span className="text-primary font-black italic mt-0.5">{num}.</span>
                <p className="text-slate-600 font-bold leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^\d+\. /, '') }} />
              </div>
            );
        }

        // Tables (Basic support)
        if (line.includes('|') && line.includes('---')) {
            inTable = true;
            return null;
        }
        if (line.includes('|')) {
            const cells = line.split('|').filter(c => c.trim().length > 0);
            return (
                <div key={index} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    {cells.map((cell, i) => (
                        <div key={i} className="flex-1 p-4 text-sm font-bold text-slate-600" dangerouslySetInnerHTML={{ __html: cell.trim() }} />
                    ))}
                </div>
            );
        }

        // Blockquotes
        if (line.startsWith('> ')) {
            return (
                <blockquote key={index} className="border-l-4 border-primary/20 bg-primary/5 p-6 rounded-2xl my-8 italic text-lg text-slate-700 font-medium">
                    {line.replace('> ', '')}
                </blockquote>
            );
        }

        // Empty line
        if (line.trim() === '') return <div key={index} className="h-4" />;

        // Paragraph
        return <p key={index} className="text-slate-600 font-bold leading-relaxed mb-6 text-lg" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      })}
    </div>
  );
}
