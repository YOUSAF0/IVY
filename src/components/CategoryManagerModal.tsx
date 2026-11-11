import React, { useState } from 'react';
import {
  X,
  Layers,
  Merge,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ScanSession } from '../types/verification';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScanSession;
  activeCategories: string[];
  onUpdateCategories: (newCategories: string[], sessionUpdates: ScanSession) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  session,
  activeCategories,
  onUpdateCategories,
}) => {
  const [sourceCategories, setSourceCategories] = useState<string[]>([]);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [newCatName, setNewCatName] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const currentCategories = activeCategories.length > 0 ? activeCategories : session.categories;

  // Calculate file count per category
  const categoryCountMap = new Map<string, number>();
  for (const c of currentCategories) {
    categoryCountMap.set(c, 0);
  }
  for (const s of session.students) {
    for (const f of s.files) {
      const match = currentCategories.find(c => c.toLowerCase() === f.category.toLowerCase());
      if (match) {
        categoryCountMap.set(match, (categoryCountMap.get(match) || 0) + 1);
      }
    }
  }

  const handleToggleSource = (cat: string) => {
    if (sourceCategories.includes(cat)) {
      setSourceCategories(sourceCategories.filter(c => c !== cat));
    } else {
      setSourceCategories([...sourceCategories, cat]);
    }
  };

  const handleExecuteMerge = () => {
    if (sourceCategories.length === 0 || !targetCategory) {
      setMessage({ text: 'Select at least one category to merge and a target category.', type: 'error' });
      return;
    }

    if (sourceCategories.includes(targetCategory)) {
      // Remove target from sources if accidentally selected
      const filteredSources = sourceCategories.filter(c => c !== targetCategory);
      if (filteredSources.length === 0) {
        setMessage({ text: 'Source and target cannot be identical.', type: 'error' });
        return;
      }
    }

    // Update all files in session matching source categories to targetCategory
    const updatedStudents = session.students.map(student => {
      const updatedFiles = student.files.map(f => {
        if (sourceCategories.some(sc => sc.toLowerCase() === f.category.toLowerCase())) {
          return {
            ...f,
            category: targetCategory,
            detectionMethod: 'Admin Manual Review' as const,
          };
        }
        return f;
      });
      return {
        ...student,
        files: updatedFiles,
      };
    });

    // Remove source categories that are not the target
    const updatedCategoriesList = currentCategories.filter(
      c => !sourceCategories.filter(sc => sc !== targetCategory).includes(c)
    );

    if (!updatedCategoriesList.includes(targetCategory)) {
      updatedCategoriesList.push(targetCategory);
    }

    const updatedSession: ScanSession = {
      ...session,
      students: updatedStudents,
      categories: updatedCategoriesList,
    };

    onUpdateCategories(updatedCategoriesList, updatedSession);
    setSourceCategories([]);
    setTargetCategory('');
    setMessage({
      text: `Successfully merged [${sourceCategories.join(', ')}] into "${targetCategory}". Verification report and matrix updated!`,
      type: 'success',
    });
  };

  const handleAddNewCategory = () => {
    if (!newCatName.trim()) return;
    const trimmed = newCatName.trim();
    if (currentCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setMessage({ text: `Category "${trimmed}" already exists.`, type: 'error' });
      return;
    }

    const updatedList = [...currentCategories, trimmed];
    onUpdateCategories(updatedList, {
      ...session,
      categories: updatedList,
    });
    setNewCatName('');
    setMessage({ text: `Created category "${trimmed}".`, type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Document Category Normalizer & Merger</h2>
              <p className="text-xs text-slate-400">
                Consolidate similar categories into standardized column names for clean reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Merge Tool Section */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Merge className="w-4 h-4" />
              <span>Merge Categories Tool</span>
            </div>
            <p className="text-xs text-slate-400">
              Select one or more duplicate categories to merge, then choose the destination column name.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. Select Categories to Merge (Source):
                </label>
                <div className="max-h-44 overflow-y-auto p-2 bg-slate-900 border border-slate-700/80 rounded-xl space-y-1">
                  {currentCategories.map(cat => {
                    const isSelected = sourceCategories.includes(cat);
                    const count = categoryCountMap.get(cat) || 0;
                    return (
                      <div
                        key={cat}
                        onClick={() => handleToggleSource(cat)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded bg-slate-800 border-slate-700 text-indigo-500"
                          />
                          <span>{cat}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {count} file{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    2. Merge Into Destination (Target):
                  </label>
                  <select
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Target Category --</option>
                    {currentCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExecuteMerge}
                  disabled={sourceCategories.length === 0 || !targetCategory}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition"
                >
                  <Merge className="w-4 h-4" />
                  <span>Merge {sourceCategories.length} into "{targetCategory || '...'}"</span>
                </button>
              </div>
            </div>
          </div>

          {/* Add Custom Category */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Add New Document Category Column:
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Migration Certificate, Character Certificate"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleAddNewCategory}
              className="mt-auto flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Category</span>
            </button>
          </div>

          {/* All Current Categories List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              All Active Document Columns ({currentCategories.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentCategories.map(cat => {
                const count = categoryCountMap.get(cat) || 0;
                return (
                  <div
                    key={cat}
                    className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-200 truncate mr-2">{cat}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
