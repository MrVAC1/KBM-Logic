import Joi from 'joi';
import { sendError } from '../utils/response.js';

const schemas = {
  createProject: Joi.object({
    name: Joi.string().trim().required().min(1).max(100),
    description: Joi.string().trim().allow('').max(500),
    password: Joi.string().min(6).required(),
    fixedCosts: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        amount: Joi.number().min(0).required(),
        frequency: Joi.string().valid('one-time', 'daily', 'weekly', 'monthly', 'yearly').default('monthly'),
        currency: Joi.string().default('USD'),
      })
    ).default([]),
  }),

  updateProject: Joi.object({
    name: Joi.string().trim().min(1).max(100),
    description: Joi.string().trim().allow('').max(500),
    fixedCosts: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        amount: Joi.number().min(0).required(),
        frequency: Joi.string().valid('one-time', 'daily', 'weekly', 'monthly', 'yearly'),
        currency: Joi.string(),
      })
    ),
    workSchedule: Joi.object({
      workingDaysPerWeek: Joi.number().min(1).max(7),
      daysOffPerWeek: Joi.number().min(0).max(6),
      hoursPerDay: Joi.number().min(1).max(24),
    }),
  }).min(1),

  createTask: Joi.object({
    title: Joi.string().trim().required().min(1).max(200),
    description: Joi.string().trim().allow('').max(1000),
    status: Joi.string().valid('Todo', 'In Progress', 'Review', 'Done').default('Todo'),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').default('Medium'),
    complexity: Joi.string().valid('Low', 'Med', 'High').default('Med'),
    assignees: Joi.array().items(Joi.string().hex().length(24)).default([]),
    startDate: Joi.date().allow(null),
    deadline: Joi.date().allow(null),
    estimateHours: Joi.number().min(0).default(0),
    plannedValue: Joi.number().min(0).default(0),
    risk: Joi.object({
      probability: Joi.number().min(1).max(5).default(1),
      impact: Joi.number().min(1).max(5).default(1),
    }).default({}),
  }),

  updateTask: Joi.object({
    title: Joi.string().trim().min(1).max(200),
    description: Joi.string().trim().allow('').max(1000),
    status: Joi.string().valid('Todo', 'In Progress', 'Review', 'Done'),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical'),
    complexity: Joi.string().valid('Low', 'Med', 'High'),
    assignees: Joi.array().items(Joi.string().hex().length(24)),
    startDate: Joi.date().allow(null),
    deadline: Joi.date().allow(null),
    estimateHours: Joi.number().min(0),
    plannedValue: Joi.number().min(0),
    risk: Joi.object({
      probability: Joi.number().min(1).max(5),
      impact: Joi.number().min(1).max(5),
    }),
  }).min(1),

  createTransaction: Joi.object({
    amount: Joi.number().positive().required(),
    type: Joi.string().valid('+', '-').required(),
    source: Joi.string().trim().required().min(1).max(100),
    date: Joi.date().default(() => new Date()),
    description: Joi.string().trim().allow('').max(500),
  }),

  joinProject: Joi.object({
    projectId: Joi.string().hex().length(24).required(),
    password: Joi.string().required(),
  }),
};

export const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return sendError(res, `Validation schema '${schemaName}' not found`, 500);
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => detail.message).join(', ');
      return sendError(res, `Validation error: ${errors}`, 400);
    }

    req.body = value;
    next();
  };
};


