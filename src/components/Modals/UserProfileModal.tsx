import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { PaySchedule } from '../../types';
import { formatCurrency, normalizeToWeekly } from '../../lib/calculations';
import { X, User, Check, Users, DollarSign, Smartphone } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, household, members, switchActiveMember, updateMemberIncome } = useHousehold();
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editSchedule, setEditSchedule] = useState<PaySchedule>('bi-weekly');

  if (!isOpen) return null;

  const handleStartEdit = (memberId: string) => {
    const target = members.find((m) => m.userId === memberId);
    if (target) {
      setEditingMemberId(memberId);
      setEditAmount(target.rawIncome);
      setEditSchedule(target.incomeSchedule);
    }
  };

  const handleSaveEdit = (memberId: string) => {
    updateMemberIncome(memberId, editAmount, editSchedule, true);
    setEditingMemberId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-grey-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-beige-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-beige-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sage-100 text-dark-green-900 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-dark-green-900">Household Members & Profiles</h2>
              <p className="text-xs text-brown-700">
                Shared Sync Code: <span className="font-mono font-bold text-dark-green-900">{household?.syncCode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-beige-100 text-dark-grey-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Session Callout */}
        <div className="p-3.5 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-3">
          <Smartphone className="w-4 h-4 text-sage-700 flex-shrink-0" />
          <div className="text-xs text-dark-green-900">
            <strong>Current Active Device Profile:</strong> {user?.name} ({user?.email})
          </div>
        </div>

        {/* Member Cards List */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-dark-green-800 block">
            Roster Members
          </span>

          {members.map((member) => {
            const isCurrentUser = member.userId === user?.userId;
            const isEditing = editingMemberId === member.userId;

            return (
              <div
                key={member.userId}
                className={`p-4 rounded-xl border transition space-y-3 ${
                  isCurrentUser
                    ? 'bg-sage-50/70 border-dark-green-700/40 ring-1 ring-dark-green-700/20'
                    : 'bg-white border-beige-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-sage-300"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-dark-green-900 text-sm">{member.name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-dark-green-800 text-white font-bold px-2 py-0.2 rounded-full">
                            Active Device
                          </span>
                        )}
                        {member.isPlaceholder && !isCurrentUser && (
                          <span className="text-[10px] bg-gold-100 text-gold-900 font-bold px-2 py-0.2 rounded-full border border-gold-300">
                            Unclaimed Slot
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-grey-600">
                        {member.hasProvidedIncome
                          ? `${formatCurrency(member.normalizedWeeklyIncome)}/week (${member.incomeSchedule})`
                          : 'Pending self-input on sign in'}
                      </span>
                    </div>
                  </div>

                  {!isCurrentUser && (
                    <button
                      onClick={() => switchActiveMember(member.userId)}
                      className="text-xs font-bold text-dark-green-800 bg-white hover:bg-beige-50 border border-beige-300 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
                    >
                      Switch To Profile
                    </button>
                  )}
                </div>

                {/* Edit Income Drawer / Inline */}
                {isEditing ? (
                  <div className="p-3 bg-beige-50 border border-beige-200 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-dark-grey-600 block mb-1">
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-dark-grey-600 block mb-1">
                          Frequency
                        </label>
                        <select
                          value={editSchedule}
                          onChange={(e) => setEditSchedule(e.target.value as PaySchedule)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-xs"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="bi-weekly">Bi-Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingMemberId(null)}
                        className="text-xs px-2.5 py-1 text-dark-grey-600 hover:text-dark-grey-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(member.userId)}
                        className="text-xs px-3 py-1 bg-dark-green-800 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleStartEdit(member.userId)}
                      className="text-[11px] text-brown-700 hover:text-dark-green-900 font-semibold cursor-pointer underline"
                    >
                      Update Income Schedule
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
