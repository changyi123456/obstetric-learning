import {useRef,useState,type FormEvent} from 'react';
import {CASES,identityErrors,type CaseId} from './palpation';

export default function PalpationIdentity({caseId,onSubmit}:{caseId:CaseId;onSubmit:(name:string,dob:string)=>void}){
 const patient=CASES[caseId],nameInput=useRef<HTMLInputElement>(null),dobInput=useRef<HTMLInputElement>(null);
 const [name,setName]=useState(''),[dob,setDob]=useState('');
 const [errors,setErrors]=useState<{name:string|null;dob:string|null}>({name:null,dob:null});
 function submit(e:FormEvent){e.preventDefault();const result=identityErrors(caseId,name,dob);setErrors(result);onSubmit(name,dob);if(result.name)nameInput.current?.focus();else if(result.dob)dobInput.current?.focus();}
 return <div className="pal-identity">
  <section className="pal-identity-card" aria-label="教學手環資料">
   <div><b>教學手環</b><small>虛構資料</small></div>
   <dl><div><dt>姓名</dt><dd>{patient.nameTag}</dd></div><div><dt>出生日期（西元）</dt><dd>{patient.dob.replaceAll('-',' / ')}</dd></div></dl>
  </section>
  <p className="pal-identity-instruction">請閱讀上方手環，輸入姓名與西元出生日期。</p>
  <form onSubmit={submit} noValidate>
   <label htmlFor="pal-patient-name">姓名</label>
   <input id="pal-patient-name" ref={nameInput} value={name} onChange={e=>{setName(e.target.value);setErrors(v=>({...v,name:null}));}} autoComplete="off" aria-invalid={!!errors.name} aria-describedby={errors.name?'pal-name-error':undefined}/>
   {errors.name&&<p id="pal-name-error" className="pal-field-error">{errors.name}</p>}
   <label htmlFor="pal-patient-dob">出生日期（西元）</label>
   <input id="pal-patient-dob" ref={dobInput} type="text" inputMode="numeric" value={dob} onChange={e=>{setDob(e.target.value);setErrors(v=>({...v,dob:null}));}} placeholder={`例如 ${patient.dob.replaceAll('-','/')}`} aria-invalid={!!errors.dob} aria-describedby={`pal-dob-hint${errors.dob?' pal-dob-error':''}`} autoComplete="off"/>
   <p id="pal-dob-hint" className="pal-field-hint">可輸入 YYYY/MM/DD、YYYY-MM-DD 或 YYYYMMDD。</p>
   {errors.dob&&<p id="pal-dob-error" className="pal-field-error">{errors.dob}</p>}
   <button type="submit" className="secondary full">核對兩項手環資料</button>
  </form>
 </div>;
}
