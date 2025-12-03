// components/quotes/NTEIncreaseList.js - List of NTE Increases for a Work Order
import { useLanguage } from '../../contexts/LanguageContext';

export default function NTEIncreaseList({
  quotes,
  loading,
  onNewQuote,
  onViewQuote,
  onDeleteQuote
}) {
  const { language } = useLanguage();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">
          💰 {language === 'en' ? 'NTE Increases' : 'Aumentos NTE'}
        </h3>
        <button
          onClick={onNewQuote}
          className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
        >
          + {language === 'en' ? 'New' : 'Nuevo'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-400">
          {language === 'en' ? 'Loading...' : 'Cargando...'}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">
            {language === 'en' ? 'No NTE increases yet' : 'Sin aumentos NTE todavía'}
          </p>
          <p className="text-xs mt-1">
            {language === 'en' 
              ? 'Tap "+ New" to create one' 
              : 'Toque "+ Nuevo" para crear uno'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((quote) => (
            <div
              key={quote.quote_id}
              className="bg-gray-700 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    quote.is_verbal_nte 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {quote.is_verbal_nte 
                      ? (language === 'en' ? '📞 Verbal' : '📞 Verbal')
                      : (language === 'en' ? '📄 Written' : '📄 Escrito')}
                  </span>
                  <span className="text-green-400 font-bold">
                    ${parseFloat(quote.grand_total || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onViewQuote(quote.quote_id)}
                    className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                  >
                    {language === 'en' ? 'View' : 'Ver'}
                  </button>
                  <button
                    onClick={() => onDeleteQuote(quote.quote_id)}
                    className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {quote.is_verbal_nte && quote.verbal_approved_by && (
                <p className="text-xs text-yellow-300 mb-1">
                  {language === 'en' ? 'Approved by' : 'Aprobado por'}: {quote.verbal_approved_by}
                </p>
              )}

              {quote.description && (
                <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                  {quote.description}
                </p>
              )}

              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  {quote.creator 
                    ? `${quote.creator.first_name} ${quote.creator.last_name}`
                    : 'Unknown'}
                </span>
                <span>
                  {new Date(quote.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
