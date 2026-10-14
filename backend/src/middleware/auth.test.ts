import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Request,Response} from 'express';
import {authenticate} from './auth.js';

afterEach(()=>vi.unstubAllEnvs());
function check(path='/workspace',authorization?:string){
 const req={method:'POST',path,headers:{authorization},query:{}} as Request;
 const res={status:vi.fn().mockReturnThis(),json:vi.fn()} as unknown as Response;
 const next=vi.fn();authenticate(req,res,next);return {res,next};
}
describe('explicit public dashboard mode',()=>{
 it('allows normal dashboard requests without a session or expiry',()=>{vi.stubEnv('PUBLIC_DASHBOARD','true');expect(check().next).toHaveBeenCalledOnce();});
 it('keeps private access enforced when public mode is off',()=>{vi.stubEnv('PUBLIC_DASHBOARD','false');expect(check().res.status).toHaveBeenCalledWith(401);});
 it('does not expose maintenance cleanup in public mode',()=>{vi.stubEnv('PUBLIC_DASHBOARD','true');vi.stubEnv('RETENTION_TOKEN','test-retention-only');const r=check('/maintenance/cleanup');expect(r.next).not.toHaveBeenCalled();expect(r.res.status).toHaveBeenCalledWith(401);});
 it('still accepts the maintenance credential in public mode',()=>{vi.stubEnv('PUBLIC_DASHBOARD','true');vi.stubEnv('RETENTION_TOKEN','test-retention-only');expect(check('/maintenance/cleanup','Bearer test-retention-only').next).toHaveBeenCalledOnce();});
});
