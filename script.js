const pricing = {
  shared: {1000:55, 5000:210, 10000:390},
  solus: {1000:95, 5000:380, 10000:720}
};

const form = document.getElementById('quote-form');
const qty = document.getElementById('quantity');
const type = document.getElementById('deliveryType');
const result = document.getElementById('quote-result');
const year = document.getElementById('year');
year.textContent = new Date().getFullYear();

function updateQuote(e){
  if (e) e.preventDefault();
  const q = qty.value;
  const t = type.value;
  const price = pricing[t][q];
  const label = t === 'shared' ? 'Shared delivery' : 'Solus delivery';
  result.innerHTML = `${q} leaflets · ${label} · <strong>£${price}</strong>`;
}
form.addEventListener('submit', updateQuote);
qty.addEventListener('change', updateQuote);
type.addEventListener('change', updateQuote);
updateQuote();
