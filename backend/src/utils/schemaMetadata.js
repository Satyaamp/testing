/**
 * DhanRekha Database Schema & Inter-table Entity-Relationship (ER) Metadata
 * Provides complete schema structure, data types, constraints, and relational
 * foreign key mappings across all MongoDB Atlas collections.
 */

const schemas = {
  expenses: {
    collection: 'expenses',
    model: 'Expense',
    icon: '💳',
    description: 'Primary financial transaction ledger storing all user expense debits and category allocations.',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'userId_1', keys: { userId: 1 }, unique: false, type: 'Foreign Key Index' },
      { name: 'userId_1_date_-1', keys: { userId: 1, date: -1 }, unique: false, type: 'Compound Query Index' },
      { name: 'userId_1_month_1_year_1', keys: { userId: 1, month: 1, year: 1 }, unique: false, type: 'Monthly Analytics Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the expense transaction record.',
        isPrimaryKey: true
      },
      {
        name: 'userId',
        type: 'ObjectId',
        required: true,
        unique: false,
        default: null,
        description: 'Foreign key referencing the User who incurred and owns this expense.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key)',
          description: 'Expenses belong to a specific User. Multiple expenses link to one user._id.'
        }
      },
      {
        name: 'amount',
        type: 'Number',
        required: true,
        unique: false,
        default: null,
        description: 'Monetary transaction amount in Indian Rupees (₹). Must be greater than 0.'
      },
      {
        name: 'category',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Classification name of the expense (e.g. Food, Transport, Rent, Bills).',
        relation: {
          targetCollection: 'categories',
          targetModel: 'Category',
          targetColumn: 'name',
          relationType: 'Many-to-One (Logical Reference)',
          description: 'References categories.name to categorize spending and enforce monthly budgets.'
        }
      },
      {
        name: 'date',
        type: 'Date',
        required: true,
        unique: false,
        default: null,
        description: 'Date and time on which the expense was incurred.'
      },
      {
        name: 'description',
        type: 'String',
        required: false,
        unique: false,
        default: "''",
        description: 'Optional remark, merchant name, or notes describing the expenditure.'
      },
      {
        name: 'isOverBudget',
        type: 'Boolean',
        required: false,
        unique: false,
        default: 'false',
        description: 'Automated flag set when this transaction exceeds the category monthly threshold.'
      },
      {
        name: 'month',
        type: 'Number',
        required: false,
        unique: false,
        default: 'Derived from date (1-12)',
        description: 'Calendar month number for fast aggregation without date parsing.'
      },
      {
        name: 'year',
        type: 'Number',
        required: false,
        unique: false,
        default: 'Derived from date (e.g. 2026)',
        description: 'Calendar year for fiscal reporting and yearly summaries.'
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Timestamp when record was initially created.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Timestamp when record was last updated.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'userId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1)',
        description: 'Every expense references users._id to isolate tenant transaction data.'
      },
      {
        direction: 'OUTGOING',
        sourceColumn: 'category',
        targetCollection: 'categories',
        targetModel: 'Category',
        targetColumn: 'name',
        type: 'Many-to-One (Reference)',
        description: 'Matches category.name to pull emoji icons, colors, and budget limits.'
      }
    ]
  },

  incomes: {
    collection: 'incomes',
    model: 'Income',
    icon: '💰',
    description: 'Income ledger tracking earnings, salaries, dividends, and other deposits.',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'userId_1', keys: { userId: 1 }, unique: false, type: 'Foreign Key Index' },
      { name: 'userId_1_date_-1', keys: { userId: 1, date: -1 }, unique: false, type: 'Query Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the income record.',
        isPrimaryKey: true
      },
      {
        name: 'userId',
        type: 'ObjectId',
        required: true,
        unique: false,
        default: null,
        description: 'Foreign key referencing the User who received and owns this income.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key)',
          description: 'Incomes belong to a specific User. Multiple incomes link to one user._id.'
        }
      },
      {
        name: 'source',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Source or payer of income (e.g. Salary, Freelance, Rental, Investment).'
      },
      {
        name: 'amount',
        type: 'Number',
        required: true,
        unique: false,
        default: null,
        description: 'Monetary credited amount in Indian Rupees (₹).'
      },
      {
        name: 'date',
        type: 'Date',
        required: true,
        unique: false,
        default: null,
        description: 'Date when funds were received or credited.'
      },
      {
        name: 'month',
        type: 'Number',
        required: false,
        unique: false,
        default: 'Derived from date (1-12)',
        description: 'Calendar month number for cashflow calculations.'
      },
      {
        name: 'year',
        type: 'Number',
        required: false,
        unique: false,
        default: 'Derived from date',
        description: 'Calendar year for annual income summaries.'
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Audit timestamp of record creation.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Audit timestamp of last update.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'userId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1)',
        description: 'Incomes belong to a single user account referencing users._id.'
      }
    ]
  },

  categories: {
    collection: 'categories',
    model: 'Category',
    icon: '🏷️',
    description: 'Category dictionary defining system defaults and custom user spending tags with monthly budgets.',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'userId_1_name_1', keys: { userId: 1, name: 1 }, unique: true, type: 'Compound Unique Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the category.',
        isPrimaryKey: true
      },
      {
        name: 'userId',
        type: 'ObjectId',
        required: false,
        unique: false,
        default: 'null (System Default)',
        description: 'References User who created custom category. null denotes global built-in system default.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key, Optional)',
          description: 'Custom categories belong to user._id; system categories have userId: null.'
        }
      },
      {
        name: 'name',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Name of the category (e.g. Food, Transport, Rent, Investment).'
      },
      {
        name: 'icon',
        type: 'String',
        required: false,
        unique: false,
        default: "'🏷️'",
        description: 'Visual emoji icon representing the category in UI cards.'
      },
      {
        name: 'color',
        type: 'String',
        required: false,
        unique: false,
        default: "'#38bdf8'",
        description: 'Hex color code used in Chart.js doughnut and bar charts.'
      },
      {
        name: 'isSystem',
        type: 'Boolean',
        required: false,
        unique: false,
        default: 'false',
        description: 'Flag indicating whether category is a global system default category.'
      },
      {
        name: 'isArchived',
        type: 'Boolean',
        required: false,
        unique: false,
        default: 'false',
        description: 'Soft-delete flag allowing user to hide deprecated categories without losing historical stats.'
      },
      {
        name: 'monthlyBudget',
        type: 'Number',
        required: false,
        unique: false,
        default: '0',
        description: 'Target monthly spending cap in ₹ for budget warning alerts.'
      },
      {
        name: 'hiddenBy',
        type: 'Array<ObjectId>',
        required: false,
        unique: false,
        default: '[]',
        description: 'Array of User ObjectIds who chose to hide this system category from their personal views.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-Many (N:M Reference Array)',
          description: 'Links multiple user._id values who opted out of seeing this category.'
        }
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Record creation timestamp.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Record last modification timestamp.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'userId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1, Nullable)',
        description: 'Custom categories link to user._id; null indicates global system default category.'
      },
      {
        direction: 'OUTGOING',
        sourceColumn: 'hiddenBy',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-Many (N:M Array)',
        description: 'Stores user._id entries who hid this category.'
      },
      {
        direction: 'INCOMING',
        sourceColumn: 'name',
        targetCollection: 'expenses',
        targetModel: 'Expense',
        targetColumn: 'category',
        type: 'One-to-Many (1:N)',
        description: 'expenses.category references categories.name to categorize spending.'
      },
      {
        direction: 'INCOMING',
        sourceColumn: 'name',
        targetCollection: 'patches',
        targetModel: 'Patch',
        targetColumn: 'category',
        type: 'One-to-Many (1:N)',
        description: 'patches.category references categories.name for prefilled 1-click templates.'
      }
    ]
  },

  users: {
    collection: 'users',
    model: 'User',
    icon: '👤',
    description: 'Central user authentication, credentials, profile metadata, and notification configuration.',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'email_1', keys: { email: 1 }, unique: true, type: 'Unique Index' },
      { name: 'phoneNumber_1', keys: { phoneNumber: 1 }, unique: true, sparse: true, type: 'Sparse Unique Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the user account.',
        isPrimaryKey: true
      },
      {
        name: 'name',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Full display name of the user.'
      },
      {
        name: 'email',
        type: 'String',
        required: true,
        unique: true,
        default: null,
        description: 'Unique email address used for login authentication and email notifications.'
      },
      {
        name: 'password',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'One-way Bcrypt cryptographic hash of the user password.'
      },
      {
        name: 'phoneNumber',
        type: 'String',
        required: false,
        unique: true,
        default: null,
        description: 'Optional phone number with country code for WhatsApp chatbot synchronization.'
      },
      {
        name: 'avatar',
        type: 'String',
        required: false,
        unique: false,
        default: 'null',
        description: 'URL to Cloudinary-hosted profile avatar image.'
      },
      {
        name: 'reminderSettings',
        type: 'Object',
        required: false,
        unique: false,
        default: '{ enabled: false, time: "21:00", timezone: "Asia/Kolkata" }',
        description: 'Daily reminder configuration object (cron time, timezone, active switch).'
      },
      {
        name: 'pushSubscriptions',
        type: 'Array<Object>',
        required: false,
        unique: false,
        default: '[]',
        description: 'Web Push API browser endpoints and crypto keys for PWA notifications.'
      },
      {
        name: 'resetPasswordToken',
        type: 'String',
        required: false,
        unique: false,
        default: 'null',
        description: 'Cryptographic SHA-256 token used for password reset verification.'
      },
      {
        name: 'resetPasswordExpires',
        type: 'Date',
        required: false,
        unique: false,
        default: 'null',
        description: 'Expiry timestamp for active password reset token.'
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Timestamp when user registered account.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Timestamp of last profile update.'
      }
    ],
    relations: [
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'expenses',
        targetModel: 'Expense',
        targetColumn: 'userId',
        type: 'One-to-Many (1:N)',
        description: 'Primary tenant relation: One user has many expenses (expenses.userId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'incomes',
        targetModel: 'Income',
        targetColumn: 'userId',
        type: 'One-to-Many (1:N)',
        description: 'One user has many incomes (incomes.userId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'patches',
        targetModel: 'Patch',
        targetColumn: 'userId',
        type: 'One-to-Many (1:N)',
        description: 'One user has many fast-add expense templates (patches.userId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'categories',
        targetModel: 'Category',
        targetColumn: 'userId',
        type: 'One-to-Many (1:N)',
        description: 'One user has custom created categories (categories.userId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'sharedaccesses',
        targetModel: 'SharedAccess',
        targetColumn: 'granterId',
        type: 'One-to-Many (1:N)',
        description: 'User as primary owner granting account sharing (sharedaccesses.granterId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'sharedaccesses',
        targetModel: 'SharedAccess',
        targetColumn: 'granteeId',
        type: 'One-to-Many (1:N)',
        description: 'User as invited recipient of shared access (sharedaccesses.granteeId -> users._id).'
      },
      {
        direction: 'INCOMING',
        sourceColumn: '_id',
        targetCollection: 'pendingexpenses',
        targetModel: 'PendingExpense',
        targetColumn: 'userId',
        type: 'One-to-Many (1:N)',
        description: 'Offline queue transactions pending sync (pendingexpenses.userId -> users._id).'
      }
    ]
  },

  patches: {
    collection: 'patches',
    model: 'Patch',
    icon: '⚡',
    description: 'Quick-add transaction templates for 1-tap recurring logging (e.g. Daily Metro, Morning Coffee).',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'userId_1_name_1', keys: { userId: 1, name: 1 }, unique: true, type: 'Compound Unique Index' },
      { name: 'userId_1', keys: { userId: 1 }, unique: false, type: 'Foreign Key Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the patch template.',
        isPrimaryKey: true
      },
      {
        name: 'userId',
        type: 'ObjectId',
        required: true,
        unique: false,
        default: null,
        description: 'Foreign key referencing the User who owns this quick-add template.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key)',
          description: 'Patches belong to a specific User (patches.userId -> users._id).'
        }
      },
      {
        name: 'name',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Template title displayed on button (e.g. "Tea & Snacks", "Auto Rickshaw"). Max 60 chars.'
      },
      {
        name: 'amount',
        type: 'Number',
        required: true,
        unique: false,
        default: null,
        description: 'Pre-set transaction amount in INR. Min: 0.01.'
      },
      {
        name: 'category',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Category name pre-selected for this shortcut.',
        relation: {
          targetCollection: 'categories',
          targetModel: 'Category',
          targetColumn: 'name',
          relationType: 'Many-to-One (Logical Reference)',
          description: 'Matches categories.name so applied patch inherits category icons and metrics.'
        }
      },
      {
        name: 'description',
        type: 'String',
        required: false,
        unique: false,
        default: "''",
        description: 'Optional default description pre-filled in logged expense.'
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Creation timestamp.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Last update timestamp.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'userId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1)',
        description: 'Links quick-add template to user account (patches.userId -> users._id).'
      },
      {
        direction: 'OUTGOING',
        sourceColumn: 'category',
        targetCollection: 'categories',
        targetModel: 'Category',
        targetColumn: 'name',
        type: 'Many-to-One (Reference)',
        description: 'References category name (patches.category -> categories.name).'
      }
    ]
  },

  sharedaccesses: {
    collection: 'sharedaccesses',
    model: 'SharedAccess',
    icon: '🤝',
    description: 'Collaborative ledger sharing and permissions delegation between users (e.g. Family or Accountant access).',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'granterId_1', keys: { granterId: 1 }, unique: false, type: 'Index' },
      { name: 'granteeId_1', keys: { granteeId: 1 }, unique: false, type: 'Index' },
      { name: 'granteeEmail_1', keys: { granteeEmail: 1 }, unique: false, type: 'Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the access sharing grant.',
        isPrimaryKey: true
      },
      {
        name: 'granterId',
        type: 'ObjectId',
        required: true,
        unique: false,
        default: null,
        description: 'Foreign key referencing the primary account owner who shared access.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key)',
          description: 'Owner account that granted ledger visibility (sharedaccesses.granterId -> users._id).'
        }
      },
      {
        name: 'granteeId',
        type: 'ObjectId',
        required: false,
        unique: false,
        default: 'null (until user registers)',
        description: 'Foreign key referencing recipient user account once invitation is claimed.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key, Nullable)',
          description: 'Invited user account linked upon signup or invitation acceptance.'
        }
      },
      {
        name: 'granteeEmail',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Email address of person invited to access the ledger.'
      },
      {
        name: 'accessLevel',
        type: 'String',
        required: true,
        unique: false,
        default: "'viewer'",
        description: "Permission level granted: 'viewer' (read-only charts & statements) or 'editor' (can add/edit)."
      },
      {
        name: 'status',
        type: 'String',
        required: true,
        unique: false,
        default: "'pending'",
        description: "Invitation status: 'pending', 'accepted', or 'revoked'."
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Date invite was issued.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Date invite status changed.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'granterId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1)',
        description: 'Points to granter user account (sharedaccesses.granterId -> users._id).'
      },
      {
        direction: 'OUTGOING',
        sourceColumn: 'granteeId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1, Nullable)',
        description: 'Points to grantee collaborator account (sharedaccesses.granteeId -> users._id).'
      }
    ]
  },

  pendingexpenses: {
    collection: 'pendingexpenses',
    model: 'PendingExpense',
    icon: '⏳',
    description: 'PWA offline sync holding queue buffering transactions entered while device is disconnected.',
    indexes: [
      { name: '_id_', keys: { _id: 1 }, unique: true, type: 'Primary Key' },
      { name: 'userId_1', keys: { userId: 1 }, unique: false, type: 'Foreign Key Index' }
    ],
    fields: [
      {
        name: '_id',
        type: 'ObjectId',
        required: true,
        unique: true,
        default: 'Auto-generated BSON ObjectId',
        description: 'Unique primary key identifier for the staged offline expense.',
        isPrimaryKey: true
      },
      {
        name: 'userId',
        type: 'ObjectId',
        required: true,
        unique: false,
        default: null,
        description: 'Foreign key referencing the User who logged the transaction offline.',
        relation: {
          targetCollection: 'users',
          targetModel: 'User',
          targetColumn: '_id',
          relationType: 'Many-to-One (N:1 Foreign Key)',
          description: 'Links offline transaction to user._id for tenant reconciliation.'
        }
      },
      {
        name: 'amount',
        type: 'Number',
        required: true,
        unique: false,
        default: null,
        description: 'Staged expense amount in ₹.'
      },
      {
        name: 'category',
        type: 'String',
        required: true,
        unique: false,
        default: null,
        description: 'Expense category name.',
        relation: {
          targetCollection: 'categories',
          targetModel: 'Category',
          targetColumn: 'name',
          relationType: 'Many-to-One (Logical Reference)',
          description: 'References categories.name to categorize offline record.'
        }
      },
      {
        name: 'description',
        type: 'String',
        required: false,
        unique: false,
        default: "''",
        description: 'Optional note recorded offline.'
      },
      {
        name: 'date',
        type: 'Date',
        required: true,
        unique: false,
        default: null,
        description: 'Original transaction timestamp when entered on device.'
      },
      {
        name: 'month',
        type: 'Number',
        required: false,
        unique: false,
        default: null,
        description: 'Month index.'
      },
      {
        name: 'year',
        type: 'Number',
        required: false,
        unique: false,
        default: null,
        description: 'Year index.'
      },
      {
        name: 'status',
        type: 'String',
        required: true,
        unique: false,
        default: "'pending'",
        description: "Synchronization state: 'pending', 'synced', or 'failed'."
      },
      {
        name: 'createdAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Offline queue insertion timestamp.'
      },
      {
        name: 'updatedAt',
        type: 'Date',
        required: false,
        unique: false,
        default: 'Date.now()',
        description: 'Last synchronization attempt timestamp.'
      }
    ],
    relations: [
      {
        direction: 'OUTGOING',
        sourceColumn: 'userId',
        targetCollection: 'users',
        targetModel: 'User',
        targetColumn: '_id',
        type: 'Many-to-One (N:1)',
        description: 'Links pending sync to users._id.'
      },
      {
        direction: 'OUTGOING',
        sourceColumn: 'category',
        targetCollection: 'categories',
        targetModel: 'Category',
        targetColumn: 'name',
        type: 'Many-to-One (Reference)',
        description: 'References categories.name.'
      }
    ]
  }
};

module.exports = schemas;
