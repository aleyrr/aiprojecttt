// NutriCare Cairo prototype: in-memory demo data; no database or real authentication.
document.addEventListener('DOMContentLoaded',()=>{
 const date=document.getElementById('consultation_date');
 if(date){const now=new Date();date.min=new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10);}
 const form=document.getElementById('booking-form');
 if(form)form.addEventListener('submit',e=>{
  e.preventDefault();
  const val=id=>document.getElementById(id).value.trim();
  const record={full_name:val('full_name'),phone:val('phone'),email:val('email'),consultation_date:val('consultation_date'),consultation_time:val('consultation_time'),goal:val('goal'),status:'Pending'};
  const error=document.getElementById('booking-error'),success=document.getElementById('booking-success');
  error.style.display='none';success.style.display='none';
  const emailOK=!record.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email);
  if(!record.full_name||!record.phone||!record.consultation_date||!record.consultation_time||!record.goal||record.consultation_date<date.min||!emailOK){
   error.textContent=!emailOK?'Please enter a valid email address.':'Please complete all required fields and choose a valid future date.';
   error.style.display='block';return;
  }
  const bookings=JSON.parse(sessionStorage.getItem('nutricareBookings')||'[]');bookings.unshift(record);sessionStorage.setItem('nutricareBookings',JSON.stringify(bookings));
  success.textContent='✓ Thank you, '+record.full_name+'! Your consultation request has been recorded in this demo. Status: Pending.';
  success.style.display='block';form.reset();date.min=new Date().toISOString().slice(0,10);
 });
 const list=document.getElementById('appointments-list');
 if(list){const bookings=JSON.parse(sessionStorage.getItem('nutricareBookings')||'[]');bookings.forEach(b=>{
  const row=document.createElement('div');row.className='rowline';const info=document.createElement('div');const name=document.createElement('b');name.textContent=b.full_name;const details=document.createElement('small');details.textContent=b.goal+' · '+b.consultation_date+' · '+b.consultation_time;info.append(name,details);const tag=document.createElement('span');tag.className='tag';tag.textContent='Pending';row.append(info,tag);list.prepend(row);
 });const a=document.getElementById('appointment-count'),p=document.getElementById('pending-count');if(a)a.textContent=String(3+bookings.length);if(p)p.textContent=String(2+bookings.length);}
 const login=document.getElementById('login-form');if(login)login.addEventListener('submit',e=>{e.preventDefault();window.location.href='booking.html';});
});
