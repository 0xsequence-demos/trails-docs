const fs = require('fs');
const https = require('https');

async function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
  });
}

async function updateChainsAndFees() {
  try {
    console.log('Fetching data from Sequence API...');
    const sequenceData = await fetchJSON('https://nodes.sequence.app/status', {
      'accept': '*/*',
      'x-access-key': 'AQAAAAAAAEDhMKr7aFdy4PIevg2ywkOvUEE'
    });

    console.log('Fetching data from Relay API...');
    const relayData = await fetchJSON('https://api.relay.link/chains');

    console.log('Processing chain data...');
    
    // Create a map of chainId to relay chain data for easier lookup
    const relayChainMap = new Map();
    relayData.chains.forEach(chain => {
      relayChainMap.set(chain.id, chain);
    });

    // Process and match chains
    const matchedChains = [];
    
    if (sequenceData.networks) {
      sequenceData.networks.forEach(network => {
        // Exclude chain ID 21000000
        if (network.id === 21000000) {
          return;
        }
        
        const relayChain = relayChainMap.get(network.id);
        if (relayChain) {
          // Process token support
          let tokenSupport = "Unknown";
          if (relayChain.tokenSupport === "All") {
            tokenSupport = "All";
          } else if (relayChain.tokenSupport === "Limited") {
            // Count supported tokens
            let supportedTokens = [];
            
            // Check main currency
            if (relayChain.currency && relayChain.currency.supportsBridging) {
              supportedTokens.push(relayChain.currency.symbol);
            }
            
            // Check ERC20 currencies
            if (relayChain.erc20Currencies) {
              relayChain.erc20Currencies.forEach(token => {
                if (token.supportsBridging && !supportedTokens.includes(token.symbol)) {
                  supportedTokens.push(token.symbol);
                }
              });
            }
            
            if (supportedTokens.length === 0) {
              tokenSupport = "Limited (0 tokens)";
            } else if (supportedTokens.length <= 3) {
              tokenSupport = `Limited (${supportedTokens.join(', ')})`;
            } else {
              tokenSupport = `Limited (${supportedTokens.length} tokens)`;
            }
          } else {
            tokenSupport = relayChain.tokenSupport || "Unknown";
          }

          matchedChains.push({
            id: network.id,
            name: relayChain.displayName || relayChain.name,
            depositFee: "0 BPS",
            withdrawalFee: `${(relayChain.withdrawalFee || 0) + 1} BPS`,
            tokenSupport: tokenSupport
          });
        }
      });
    }

    // Sort chains by name
    matchedChains.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${matchedChains.length} matching chains`);

    // Generate table rows
    const tableRows = matchedChains.map(chain => {
      return `        <tr>
          <td style={{textTransform: "capitalize", padding: "12px 8px", borderBottom: "1px solid #e5e7eb"}}>${chain.name}</td>
          <td style={{padding: "12px 8px", borderBottom: "1px solid #e5e7eb"}}>${chain.id}</td>
          <td style={{padding: "12px 8px", borderBottom: "1px solid #e5e7eb"}}>${chain.depositFee}</td>
          <td style={{padding: "12px 8px", borderBottom: "1px solid #e5e7eb"}}>${chain.withdrawalFee}</td>
          <td style={{padding: "12px 8px", borderBottom: "1px solid #e5e7eb"}}>${chain.tokenSupport}</td>
        </tr>`;
    }).join('\n');

    // Generate the updated MDX content
    const updatedContent = `export const Chains = ({ env, id }) => {
  return (
    <table
      style={{ 
        width: "100%", 
        borderCollapse: "collapse",
        tableLayout: "fixed"
      }}
      className="Trails-table"
    >
      <thead
        style={{
          borderBottom: "2px solid rgb(227 226 230)",
          backgroundColor: "#f9fafb"
        }}
      >
        <tr style={{ textAlign: "left" }}>
          <th style={{ padding: "16px 8px", fontWeight: "600", fontSize: "14px" }}>Network Name</th>
          <th style={{ padding: "16px 8px", fontWeight: "600", fontSize: "14px" }}>Chain ID</th>
          <th style={{ padding: "16px 8px", fontWeight: "600", fontSize: "14px" }}>Deposit Fee</th>
          <th style={{ padding: "16px 8px", fontWeight: "600", fontSize: "14px" }}>Withdrawal Fee</th>
          <th style={{ padding: "16px 8px", fontWeight: "600", fontSize: "14px" }}>Token Support</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  );
};
`;

    // Write the updated content to the file
    fs.writeFileSync('snippets/ChainsAndFees.mdx', updatedContent);
    
    console.log('Successfully updated ChainsAndFees.mdx');
    console.log(`Updated with ${matchedChains.length} chains`);
    
  } catch (error) {
    console.error('Error updating chains and fees:', error);
    process.exit(1);
  }
}

// updateChainsAndFees(); 
