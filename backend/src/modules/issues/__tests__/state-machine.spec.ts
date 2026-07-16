import { StateMachine } from '../state-machine';

describe('StateMachine', () => {
  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  describe('getAllowedTransitions', () => {
    it('NEW allows ACKNOWLEDGED and ASSIGNED', () => {
      expect(stateMachine.getAllowedTransitions('NEW')).toEqual(['ACKNOWLEDGED', 'ASSIGNED']);
    });

    it('ACKNOWLEDGED allows ASSIGNED', () => {
      expect(stateMachine.getAllowedTransitions('ACKNOWLEDGED')).toEqual(['ASSIGNED']);
    });

    it('ASSIGNED allows IN_PROGRESS', () => {
      expect(stateMachine.getAllowedTransitions('ASSIGNED')).toEqual(['IN_PROGRESS']);
    });

    it('IN_PROGRESS allows RESOLVED', () => {
      expect(stateMachine.getAllowedTransitions('IN_PROGRESS')).toEqual(['RESOLVED']);
    });

    it('RESOLVED allows VERIFIED and REOPENED', () => {
      expect(stateMachine.getAllowedTransitions('RESOLVED')).toEqual(['VERIFIED', 'REOPENED']);
    });

    it('VERIFIED allows CLOSED and REOPENED', () => {
      expect(stateMachine.getAllowedTransitions('VERIFIED')).toEqual(['CLOSED', 'REOPENED']);
    });

    it('CLOSED allows REOPENED', () => {
      expect(stateMachine.getAllowedTransitions('CLOSED')).toEqual(['REOPENED']);
    });

    it('REOPENED allows IN_PROGRESS', () => {
      expect(stateMachine.getAllowedTransitions('REOPENED')).toEqual(['IN_PROGRESS']);
    });
  });

  describe('canTransition', () => {
    it('valid transition NEW -> ACKNOWLEDGED', () => {
      expect(stateMachine.canTransition('NEW', 'ACKNOWLEDGED')).toEqual({ valid: true });
    });

    it('valid transition NEW -> ASSIGNED', () => {
      expect(stateMachine.canTransition('NEW', 'ASSIGNED')).toEqual({ valid: true });
    });

    it('valid transition ASSIGNED -> IN_PROGRESS', () => {
      expect(stateMachine.canTransition('ASSIGNED', 'IN_PROGRESS')).toEqual({ valid: true });
    });

    it('valid transition IN_PROGRESS -> RESOLVED', () => {
      expect(stateMachine.canTransition('IN_PROGRESS', 'RESOLVED')).toEqual({ valid: true });
    });

    it('valid transition RESOLVED -> VERIFIED', () => {
      expect(stateMachine.canTransition('RESOLVED', 'VERIFIED')).toEqual({ valid: true });
    });

    it('valid transition VERIFIED -> CLOSED', () => {
      expect(stateMachine.canTransition('VERIFIED', 'CLOSED')).toEqual({ valid: true });
    });

    it('valid transition CLOSED -> REOPENED', () => {
      expect(stateMachine.canTransition('CLOSED', 'REOPENED')).toEqual({ valid: true });
    });

    it('valid transition REOPENED -> IN_PROGRESS', () => {
      expect(stateMachine.canTransition('REOPENED', 'IN_PROGRESS')).toEqual({ valid: true });
    });

    it('valid transition RESOLVED -> REOPENED', () => {
      expect(stateMachine.canTransition('RESOLVED', 'REOPENED')).toEqual({ valid: true });
    });

    it('valid transition VERIFIED -> REOPENED', () => {
      expect(stateMachine.canTransition('VERIFIED', 'REOPENED')).toEqual({ valid: true });
    });

    it('invalid transition NEW -> CLOSED', () => {
      const result = stateMachine.canTransition('NEW', 'CLOSED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition from NEW to CLOSED');
      expect(result.allowedTransitions).toEqual(['ACKNOWLEDGED', 'ASSIGNED']);
    });

    it('invalid transition NEW -> IN_PROGRESS', () => {
      const result = stateMachine.canTransition('NEW', 'IN_PROGRESS');
      expect(result.valid).toBe(false);
      expect(result.allowedTransitions).toEqual(['ACKNOWLEDGED', 'ASSIGNED']);
    });

    it('invalid transition NEW -> RESOLVED', () => {
      const result = stateMachine.canTransition('NEW', 'RESOLVED');
      expect(result.valid).toBe(false);
    });

    it('invalid transition ASSIGNED -> RESOLVED', () => {
      const result = stateMachine.canTransition('ASSIGNED', 'RESOLVED');
      expect(result.valid).toBe(false);
      expect(result.allowedTransitions).toEqual(['IN_PROGRESS']);
    });

    it('invalid transition CLOSED -> ASSIGNED', () => {
      const result = stateMachine.canTransition('CLOSED', 'ASSIGNED');
      expect(result.valid).toBe(false);
      expect(result.allowedTransitions).toEqual(['REOPENED']);
    });

    it('invalid transition to same state', () => {
      const result = stateMachine.canTransition('NEW', 'NEW');
      expect(result.valid).toBe(false);
    });
  });
});
