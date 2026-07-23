import { StateMachine } from '../state-machine';

describe('StateMachine — new branched workflow', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  // ─── getAllowedTransitions ───────────────────────────────────────────────────
  describe('getAllowedTransitions', () => {
    it('NEW allows UNDER_REVIEW', () => {
      expect(sm.getAllowedTransitions('NEW')).toEqual(['UNDER_REVIEW']);
    });
    it('UNDER_REVIEW allows CLARIFICATION_REQUESTED and ASSIGNED', () => {
      expect(sm.getAllowedTransitions('UNDER_REVIEW')).toEqual(['CLARIFICATION_REQUESTED', 'ASSIGNED']);
    });
    it('CLARIFICATION_REQUESTED allows UNDER_REVIEW and IN_PROGRESS', () => {
      expect(sm.getAllowedTransitions('CLARIFICATION_REQUESTED')).toEqual(['UNDER_REVIEW', 'IN_PROGRESS']);
    });
    it('ASSIGNED allows IN_PROGRESS', () => {
      expect(sm.getAllowedTransitions('ASSIGNED')).toEqual(['IN_PROGRESS']);
    });
    it('IN_PROGRESS allows CLARIFICATION_REQUESTED', () => {
      expect(sm.getAllowedTransitions('IN_PROGRESS')).toEqual(['CLARIFICATION_REQUESTED']);
    });
    it('IN_QA allows PENDING_CLIENT_APPROVAL and IN_PROGRESS', () => {
      expect(sm.getAllowedTransitions('IN_QA')).toEqual(['PENDING_CLIENT_APPROVAL', 'IN_PROGRESS']);
    });
    it('SI_REVIEW allows PENDING_CLIENT_APPROVAL and ASSIGNED', () => {
      expect(sm.getAllowedTransitions('SI_REVIEW')).toEqual(['PENDING_CLIENT_APPROVAL', 'ASSIGNED']);
    });
    it('PENDING_CLIENT_APPROVAL allows CLOSED and ASSIGNED', () => {
      expect(sm.getAllowedTransitions('PENDING_CLIENT_APPROVAL')).toEqual(['CLOSED', 'ASSIGNED']);
    });
    it('CLOSED allows UNDER_REVIEW', () => {
      expect(sm.getAllowedTransitions('CLOSED')).toEqual(['UNDER_REVIEW']);
    });
  });

  // ─── canTransition — valid paths ────────────────────────────────────────────
  describe('canTransition — valid', () => {
    // Flow A: Client -> SI
    it('NEW -> UNDER_REVIEW', () => expect(sm.canTransition('NEW', 'UNDER_REVIEW')).toEqual({ valid: true }));
    it('UNDER_REVIEW -> CLARIFICATION_REQUESTED', () => expect(sm.canTransition('UNDER_REVIEW', 'CLARIFICATION_REQUESTED')).toEqual({ valid: true }));
    it('UNDER_REVIEW -> ASSIGNED', () => expect(sm.canTransition('UNDER_REVIEW', 'ASSIGNED')).toEqual({ valid: true }));
    it('CLARIFICATION_REQUESTED -> UNDER_REVIEW', () => expect(sm.canTransition('CLARIFICATION_REQUESTED', 'UNDER_REVIEW')).toEqual({ valid: true }));
    it('CLARIFICATION_REQUESTED -> IN_PROGRESS', () => expect(sm.canTransition('CLARIFICATION_REQUESTED', 'IN_PROGRESS')).toEqual({ valid: true }));
    it('ASSIGNED -> IN_PROGRESS', () => expect(sm.canTransition('ASSIGNED', 'IN_PROGRESS')).toEqual({ valid: true }));
    it('IN_PROGRESS -> CLARIFICATION_REQUESTED', () => expect(sm.canTransition('IN_PROGRESS', 'CLARIFICATION_REQUESTED')).toEqual({ valid: true }));
    it('IN_PROGRESS -> RESOLVED (virtual)', () => expect(sm.canTransition('IN_PROGRESS', 'RESOLVED')).toEqual({ valid: true }));
    
    // Virtual RESOLVED transitions handled by service, we only test the raw state machine transitions allowed
    it('IN_QA -> PENDING_CLIENT_APPROVAL', () => expect(sm.canTransition('IN_QA', 'PENDING_CLIENT_APPROVAL')).toEqual({ valid: true }));
    it('IN_QA -> IN_PROGRESS (reject)', () => expect(sm.canTransition('IN_QA', 'IN_PROGRESS')).toEqual({ valid: true }));

    it('SI_REVIEW -> PENDING_CLIENT_APPROVAL (approve)', () => expect(sm.canTransition('SI_REVIEW', 'PENDING_CLIENT_APPROVAL')).toEqual({ valid: true }));
    it('SI_REVIEW -> ASSIGNED (reject)', () => expect(sm.canTransition('SI_REVIEW', 'ASSIGNED')).toEqual({ valid: true }));

    it('PENDING_CLIENT_APPROVAL -> CLOSED (approve)', () => expect(sm.canTransition('PENDING_CLIENT_APPROVAL', 'CLOSED')).toEqual({ valid: true }));
    it('PENDING_CLIENT_APPROVAL -> ASSIGNED (reject)', () => expect(sm.canTransition('PENDING_CLIENT_APPROVAL', 'ASSIGNED')).toEqual({ valid: true }));

    it('CLOSED -> UNDER_REVIEW (reopen)', () => expect(sm.canTransition('CLOSED', 'UNDER_REVIEW')).toEqual({ valid: true }));
  });

  // ─── canTransition — invalid paths ──────────────────────────────────────────
  describe('canTransition — invalid', () => {
    it('NEW -> CLOSED is invalid', () => {
      const r = sm.canTransition('NEW', 'CLOSED');
      expect(r.valid).toBe(false);
      expect(r.error).toContain('Cannot transition from NEW to CLOSED');
      expect(r.allowedTransitions).toEqual(['UNDER_REVIEW']);
    });
    it('NEW -> IN_PROGRESS is invalid', () => {
      expect(sm.canTransition('NEW', 'IN_PROGRESS').valid).toBe(false);
    });
    it('ASSIGNED -> CLOSED is invalid', () => {
      const r = sm.canTransition('ASSIGNED', 'CLOSED');
      expect(r.valid).toBe(false);
      expect(r.allowedTransitions).toEqual(['IN_PROGRESS']);
    });
    it('CLOSED -> ASSIGNED is invalid', () => {
      const r = sm.canTransition('CLOSED', 'ASSIGNED');
      expect(r.valid).toBe(false);
      expect(r.allowedTransitions).toEqual(['UNDER_REVIEW']);
    });
    it('IN_PROGRESS -> CLOSED is invalid (skipping steps)', () => {
      expect(sm.canTransition('IN_PROGRESS', 'CLOSED').valid).toBe(false);
    });
    it('same-state transition is invalid', () => {
      expect(sm.canTransition('NEW', 'NEW').valid).toBe(false);
    });
    it('RESOLVED -> anything is invalid (RESOLVED is virtual and never stored)', () => {
      expect(sm.canTransition('PENDING_CLIENT_APPROVAL' as any, 'RESOLVED' as any).valid).toBe(false);
    });
  });
});
