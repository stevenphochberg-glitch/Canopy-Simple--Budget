with open('src/components/Ledger/CategoryLedgerView.tsx', 'r') as f:
    content = f.read()

# Fix mKey definition around line 876
bad_mkey = "const mKey = ;\n\n      const isSeptember ="
good_mkey = "const mKey = `${fm.fiscalYear || fm.endDate.getFullYear()}-M${fm.fiscalMonthNumber}`;\n\n      const isSeptember ="
content = content.replace(bad_mkey, good_mkey)

# Fix inner className around line 2114
bad_classname = 'className={}\n                >'
good_classname = 'className={`rounded-xl p-4 sm:p-5 shadow-xs transition-all space-y-3 ${group.isMonthlyReviewCompleted ? "bg-white border-2 border-sage-200 hover:border-sage-400 hover:shadow-sm" : "bg-white border border-sage-200/90 hover:border-sage-300"}`}\n                >'
content = content.replace(bad_classname, good_classname)

# Fix group id around line 2235
bad_group_id = 'id={}\n                    className="bg-sage-50/80 border-2 border-sage-300'
good_group_id = 'id={`savings-month-group-${group.monthKey}`}\n                    className="bg-sage-50/80 border-2 border-sage-300'
content = content.replace(bad_group_id, good_group_id)

# Fix heading id around line 2240
bad_heading_id = 'id={}\n                      className="bg-sage-100 border border-sage-300/90'
good_heading_id = 'id={`savings-month-heading-${group.monthKey}`}\n                      className="bg-sage-100 border border-sage-300/90'
content = content.replace(bad_heading_id, good_heading_id)

with open('src/components/Ledger/CategoryLedgerView.tsx', 'w') as f:
    f.write(content)

print("Fix applied successfully!")
