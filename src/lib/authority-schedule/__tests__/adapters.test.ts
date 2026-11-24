import { describe, expect, it } from 'vitest';
import { evaluateCapability } from '../adapters';
describe('adapter contracts', () => it('fails closed as unknown without identity or trusted evidence', () => expect(evaluateCapability({capability:'vehicles.self_regularize_prior_occupancy'}).state).toBe('unknown')));
